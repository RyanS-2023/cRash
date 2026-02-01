import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CreditsService } from '../services/credits';
import { Auth } from '@angular/fire/auth';

interface Reel {
  symbols: string[];
  element: HTMLElement | null;
  position: number;
}

interface WinResult {
  lineIndex: number;
  symbol: string;
  count: number;
  payout: number;
  positions: number[];
}

@Component({
  selector: 'app-skol-slot',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skol-slot.html',
  styleUrls: ['./skol-slot.css'], // NOTE: styleUrls (plural)
})
export class SkolSlotComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly SYMBOLS = ['🏆', '🏈', '⚔️', '🛡️', '👑', '⚡', '💜', 'V'];

  private readonly REEL_STRIPS = [
    ['⚡','💜','V','👑','🛡️','⚔️','💜','V','⚡','👑','🛡️','V','💜','⚔️','🏈','V','⚡','👑','💜','🛡️','V','⚔️','⚡','👑','🏆','V','💜','🛡️','⚔️','V'],
    ['V','💜','⚡','🛡️','👑','V','⚔️','💜','⚡','🛡️','V','👑','🏈','💜','⚡','V','🛡️','👑','⚔️','V','💜','⚡','🏆','🛡️','V','👑','💜','⚔️','V','⚡'],
    ['⚡','V','👑','💜','🛡️','⚔️','V','⚡','💜','🏈','👑','🛡️','V','⚔️','⚡','💜','V','👑','🛡️','🏆','⚔️','V','⚡','💜','👑','V','🛡️','⚔️','💜','V'],
    ['💜','V','⚡','🛡️','👑','⚔️','V','💜','⚡','🛡️','👑','V','⚔️','🏈','💜','⚡','V','🛡️','👑','⚔️','💜','V','⚡','🏆','🛡️','👑','V','⚔️','💜','V'],
    ['V','⚡','💜','👑','🛡️','V','⚔️','⚡','💜','🛡️','👑','V','⚔️','⚡','🏈','💜','V','🛡️','👑','⚔️','V','⚡','💜','🛡️','🏆','👑','V','⚔️','⚡','V'],
  ];

  private readonly SYMBOL_HEIGHT = 105;
  private readonly VISIBLE_SYMBOLS = 3;
  private readonly BET_LEVELS = [1, 2, 5, 10, 20, 50, 100];

  private readonly PAYTABLE: Record<string, Record<number, number>> = {
    '🏆': { 5: 2000, 4: 400, 3: 80, 2: 10 },
    '🏈': { 5: 1000, 4: 200, 3: 50, 2: 5 },
    '⚔️': { 5: 600, 4: 150, 3: 40, 2: 4 },
    '🛡️': { 5: 400, 4: 100, 3: 25, 2: 3 },
    '👑': { 5: 300, 4: 80, 3: 20, 2: 2 },
    '⚡': { 5: 200, 4: 50, 3: 15 },
    '💜': { 5: 150, 4: 40, 3: 10 },
    'V':  { 5: 100, 4: 30, 3: 8 },
  };

  readonly PAYLINES: number[][] = [
    [0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],
    [0,1,1,1,0],[2,1,1,1,2],[0,1,2,1,0],
    [2,1,0,1,2],[0,1,0,1,0],[2,1,2,1,2],
    [0,0,1,2,2],[2,2,1,0,0],[1,0,1,2,1],
    [1,2,1,0,1],[0,1,0,2,0],[2,1,2,0,2],
    [0,0,0,1,2],[2,2,2,1,0],[1,0,0,0,1],
    [1,2,2,2,1],[0,2,0,2,0],[2,0,2,0,2],
    [0,1,2,0,1],[2,1,0,2,1],[1,0,1,0,1],
    [1,2,1,2,1],
  ];

  balance = 0;
  currentBet = 1;
  lastWin = 0;
  isSpinning = false;
  private isSaving = false;
  private betIndex = 0;

  showWinOverlay = false;
  showPaytable = false;
  showDailyBanner = false;

  winTitle = '';
  winAmount = '';
  timeUntilNextCredit = '';

  winningReels = new Set<number>();
  winningLines = new Set<number>();
  currentWins: WinResult[] = [];
  highlightedPayline: number | null = null;

  clientSeed = '';
  serverSeed = '';
  spinNonce = 0;
  lastSpinHash = '';

  reels: Reel[] = [];
  private reelsInitialized = false;
  private userId = '';

  constructor(
    private router: Router,
    private creditsService: CreditsService,
    private auth: Auth
  ) {
    this.reels = Array.from({ length: 5 }, (_, index) => ({
      symbols: this.REEL_STRIPS[index]
        ? [...this.REEL_STRIPS[index], ...this.REEL_STRIPS[index], ...this.REEL_STRIPS[index]]
        : [],
      element: null,
      position: 0,
    }));

    this.clientSeed = this.generateRandomSeed();
    this.serverSeed = this.generateRandomSeed();
  }

  ngOnInit(): void {
    void this.loadUserCredits();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initReels();
      setTimeout(() => {
        if (!this.reelsInitialized) this.initReels();
      }, 300);
    }, 150);
  }

  ngOnDestroy(): void {
    if (this.userId) void this.saveBalance();
  }

  async loadUserCredits(): Promise<void> {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        this.router.navigate(['/login']);
        return;
      }

      this.userId = user.uid;

      const credits = await this.creditsService.getUserCredits();

      const today = new Date().toISOString().split('T')[0];
      if (credits.lastDailyCredit === today && this.balance === 0) {
        this.showDailyBanner = true;
        setTimeout(() => (this.showDailyBanner = false), 5000);
      }

      this.balance = credits.balance;
      await this.updateTimeUntilNextCredit();
    } catch (error) {
      console.error('Error loading credits:', error);
      alert('Failed to load credits');
    }
  }

  async updateTimeUntilNextCredit(): Promise<void> {
    this.timeUntilNextCredit = await this.creditsService.getTimeUntilNextDailyCredit();
  }

  calculatePayout(symbol: string, count: number): number {
    return (this.PAYTABLE[symbol]?.[count] || 0) * this.currentBet;
  }

  togglePaytable(): void {
    this.showPaytable = !this.showPaytable;
    if (this.showPaytable) void this.updateTimeUntilNextCredit();
  }

  highlightPayline(index: number): void {
    this.highlightedPayline = this.highlightedPayline === index ? null : index;
  }

  scrollToFairness(): void {
    setTimeout(() => {
      document.querySelector('.provably-fair')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  private generateRandomSeed(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  regenerateClientSeed(): void {
    this.clientSeed = this.generateRandomSeed();
    this.spinNonce = 0;
  }

  private async generateHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async generateProvablyFairResult(): Promise<number[]> {
    this.spinNonce++;
    const combinedSeed = `${this.serverSeed}:${this.clientSeed}:${this.spinNonce}`;
    this.lastSpinHash = await this.generateHash(combinedSeed);

    const positions: number[] = [];
    for (let i = 0; i < 5; i++) {
      const seg = this.lastSpinHash.substring(i * 12, (i + 1) * 12);
      const num = parseInt(seg, 16);
      positions.push(num % this.REEL_STRIPS[i].length);
    }
    return positions;
  }

  private initReels(): void {
    let allFound = true;

    for (let i = 0; i < 5; i++) {
      const el = document.getElementById('reel-' + i);
      if (!el) {
        allFound = false;
        continue;
      }
      this.reels[i].element = el;
      this.reels[i].position = 0;
      el.style.transform = 'translateY(0px)';
      el.style.transition = 'none';
      el.style.willChange = 'transform';
    }

    this.reelsInitialized = allFound;
  }

  async spin(): Promise<void> {
    if (this.isSpinning || !this.reelsInitialized) return;

    const totalBet = this.currentBet * 25;
    if (this.balance < totalBet) return;

    this.isSpinning = true;
    this.balance -= totalBet;
    this.lastWin = 0;
    this.winningReels.clear();
    this.winningLines.clear();
    this.currentWins = [];

    const targetPositions = await this.generateProvablyFairResult();
    const spinPromises: Promise<void>[] = [];

    for (let index = 0; index < 5; index++) {
      const reel = this.reels[index];
      const reelElement = reel.element;
      if (!reelElement) continue;

      spinPromises.push(new Promise<void>((resolve) => {
        reelElement.style.transition = 'none';

        const stripLength = this.REEL_STRIPS[index].length;
        const spins = 3 + index * 0.5;
        const targetPos = targetPositions[index] + Math.floor(stripLength * spins);
        const startPos = reel.position;
        const duration = 2000 + index * 200;
        const startTime = Date.now();

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easeOut = 1 - Math.pow(1 - progress, 3);

          const currentPos = startPos + (targetPos - startPos) * easeOut;
          reelElement.style.transform = `translateY(-${currentPos * this.SYMBOL_HEIGHT}px)`;

          if (progress < 1) requestAnimationFrame(animate);
          else {
            const normalized = targetPos % stripLength;
            reel.position = normalized;
            reelElement.style.transform = `translateY(-${normalized * this.SYMBOL_HEIGHT}px)`;
            resolve();
          }
        };

        setTimeout(() => requestAnimationFrame(animate), index * 150);
      }));
    }

    await Promise.all(spinPromises);
    await this.checkWin();
    this.isSpinning = false;
  }

  private getVisibleSymbols(): string[][] {
    const grid: string[][] = [];

    for (let reelIndex = 0; reelIndex < 5; reelIndex++) {
      const reel = this.reels[reelIndex];
      const col: string[] = [];
      const basePos = Math.floor(reel.position);
      const stripLength = this.REEL_STRIPS[reelIndex].length;

      for (let i = 0; i < this.VISIBLE_SYMBOLS; i++) {
        col.push(this.REEL_STRIPS[reelIndex][(basePos + i) % stripLength]);
      }

      grid.push(col);
    }

    return grid;
  }

  private async checkWin(): Promise<void> {
    const grid = this.getVisibleSymbols();
    let totalWin = 0;
    const wins: WinResult[] = [];
    const winningLinesSet = new Set<number>();

    this.PAYLINES.forEach((payline, lineIndex) => {
      const symbols = payline.map((row, col) => grid[col][row]);
      const lineWin = this.checkLine(symbols);
      if (lineWin.payout > 0) {
        totalWin += lineWin.payout;
        winningLinesSet.add(lineIndex);
        wins.push({ lineIndex, ...lineWin });
      }
    });

    if (totalWin > 0) {
      this.balance += totalWin;
      this.lastWin = totalWin;
      this.winningLines = winningLinesSet;
      this.currentWins = wins;

      try {
        await this.creditsService.recordWin(this.userId, totalWin);
      } catch {}

      this.showWinAnimation(totalWin);
    } else {
      await this.saveBalance();
    }
  }

  private checkLine(symbols: string[]): { payout: number; positions: number[]; symbol: string; count: number } {
    let best = { payout: 0, positions: [] as number[], symbol: '', count: 0 };

    for (const symbol of this.SYMBOLS) {
      let count = 0;
      for (let i = 0; i < symbols.length; i++) {
        if (symbols[i] === symbol) count++;
        else break;
      }

      if (count >= 2 && this.PAYTABLE[symbol]?.[count]) {
        const payout = this.PAYTABLE[symbol][count] * this.currentBet;
        if (payout > best.payout) {
          best = { payout, positions: Array.from({ length: count }, (_, i) => i), symbol, count };
        }
      }
    }

    return best;
  }

  private showWinAnimation(amount: number): void {
    const totalBet = this.currentBet * 25;
    const mult = amount / totalBet;

    this.winTitle =
      mult >= 100 ? '💎🏆 LEGENDARY WIN! 🏆💎' :
      mult >= 50  ? '🏆💎 MEGA JACKPOT! 💎🏆' :
      mult >= 25  ? '🏆 JACKPOT! 🏆' :
      mult >= 10  ? '⚡ BIG WIN! ⚡' :
      mult >= 5   ? '💰 GREAT WIN! 💰' :
                   '✨ WINNER! ✨';

    this.winAmount = `${amount} CREDITS`;
    this.showWinOverlay = true;

    setTimeout(() => {
      this.showWinOverlay = false;
      this.winningReels.clear();
      this.winningLines.clear();
      void this.saveBalance();
    }, 4500);
  }

  private async saveBalance(): Promise<void> {
    if (!this.userId || this.isSaving) return;

    this.isSaving = true;
    try {
      await this.creditsService.updateBalance(this.userId, this.balance);
    } finally {
      this.isSaving = false;
    }
  }

  increaseBet(): void {
    if (this.betIndex < this.BET_LEVELS.length - 1) {
      this.betIndex++;
      this.currentBet = this.BET_LEVELS[this.betIndex];
    }
  }

  decreaseBet(): void {
    if (this.betIndex > 0) {
      this.betIndex--;
      this.currentBet = this.BET_LEVELS[this.betIndex];
    }
  }

  maxBet(): void {
    this.betIndex = this.BET_LEVELS.length - 1;
    this.currentBet = this.BET_LEVELS[this.betIndex];
  }

  goBack(): void {
    void this.saveBalance();
    this.router.navigate(['/lobby']);
  }
}
