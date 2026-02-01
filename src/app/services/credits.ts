import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, updateDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

export interface UserCredits {
  balance: number;
  lastDailyCredit: string; // ISO date string
  totalWagered: number;
  totalWon: number;
  lifetimeCredits: number;
}

@Injectable({
  providedIn: 'root'
})
export class CreditsService {
  private readonly DAILY_CREDITS = 1000;
  private readonly MAX_CREDITS = 50000; // Cap to prevent abuse

  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) {}

  async getUserCredits(): Promise<UserCredits> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const creditsRef = doc(this.firestore, 'userCredits', user.uid);
    const creditsSnap = await getDoc(creditsRef);

    if (creditsSnap.exists()) {
      const data = creditsSnap.data() as UserCredits;
      
      // Check if user should get daily credits
      const today = new Date().toISOString().split('T')[0];
      if (data.lastDailyCredit !== today) {
        // Award daily credits
        const newBalance = Math.min(data.balance + this.DAILY_CREDITS, this.MAX_CREDITS);
        await updateDoc(creditsRef, {
          balance: newBalance,
          lastDailyCredit: today,
          lifetimeCredits: data.lifetimeCredits + this.DAILY_CREDITS
        });

        return {
          ...data,
          balance: newBalance,
          lastDailyCredit: today,
          lifetimeCredits: data.lifetimeCredits + this.DAILY_CREDITS
        };
      }

      return data;
    } else {
      // First time user - initialize with daily credits
      const today = new Date().toISOString().split('T')[0];
      const initialCredits: UserCredits = {
        balance: this.DAILY_CREDITS,
        lastDailyCredit: today,
        totalWagered: 0,
        totalWon: 0,
        lifetimeCredits: this.DAILY_CREDITS
      };

      await setDoc(creditsRef, initialCredits);
      return initialCredits;
    }
  }

  async updateBalance(userId: string, newBalance: number): Promise<void> {
    const creditsRef = doc(this.firestore, 'userCredits', userId);
    await updateDoc(creditsRef, { balance: newBalance });
  }

  async recordWager(userId: string, amount: number): Promise<void> {
    const creditsRef = doc(this.firestore, 'userCredits', userId);
    const creditsSnap = await getDoc(creditsRef);
    
    if (creditsSnap.exists()) {
      const data = creditsSnap.data() as UserCredits;
      await updateDoc(creditsRef, {
        balance: data.balance - amount,
        totalWagered: data.totalWagered + amount
      });
    }
  }

  async recordWin(userId: string, amount: number): Promise<void> {
    const creditsRef = doc(this.firestore, 'userCredits', userId);
    const creditsSnap = await getDoc(creditsRef);
    
    if (creditsSnap.exists()) {
      const data = creditsSnap.data() as UserCredits;
      await updateDoc(creditsRef, {
        balance: data.balance + amount,
        totalWon: data.totalWon + amount
      });
    }
  }

  async getTimeUntilNextDailyCredit(): Promise<string> {
    const user = this.auth.currentUser;
    if (!user) return 'Not logged in';

    const creditsRef = doc(this.firestore, 'userCredits', user.uid);
    const creditsSnap = await getDoc(creditsRef);

    if (creditsSnap.exists()) {
      const data = creditsSnap.data() as UserCredits;
      const lastCredit = new Date(data.lastDailyCredit + 'T00:00:00');
      const nextCredit = new Date(lastCredit);
      nextCredit.setDate(nextCredit.getDate() + 1);
      
      const now = new Date();
      const diff = nextCredit.getTime() - now.getTime();
      
      if (diff <= 0) return 'Available now!';
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      return `${hours}h ${minutes}m`;
    }

    return 'Available now!';
  }

  // For future ad rewards
  async addAdReward(userId: string, amount: number = 100): Promise<void> {
    const creditsRef = doc(this.firestore, 'userCredits', userId);
    const creditsSnap = await getDoc(creditsRef);
    
    if (creditsSnap.exists()) {
      const data = creditsSnap.data() as UserCredits;
      const newBalance = Math.min(data.balance + amount, this.MAX_CREDITS);
      await updateDoc(creditsRef, {
        balance: newBalance,
        lifetimeCredits: data.lifetimeCredits + amount
      });
    }
  }
}