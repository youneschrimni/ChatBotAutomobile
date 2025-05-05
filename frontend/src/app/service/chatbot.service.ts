import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface User {
  username: string;
  email: string;
}

export interface ChatHistory {
  session_id: string;
  label: string;
  created_at: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private baseUrl = 'http://217.154.22.108:80/api';
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private userSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
  currentUser$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) { }

  private hasToken(): boolean {
    return !!localStorage.getItem('auth_token');
  }

  private getUserFromStorage(): User | null {
    const username = localStorage.getItem('user_name');
    const email = localStorage.getItem('user_email');
    
    if (username && email) {
      return { username, email };
    }
    
    return null;
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  register(username: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/register`, {
      username,
      email,
      password
    });
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/login`, {
      email,
      password
    }).pipe(
      tap((response: any) => {
        localStorage.setItem('auth_token', response.token);
        
        localStorage.setItem('user_email', email);
        const username = email.split('@')[0];
        localStorage.setItem('user_name', username);
        
        this.isAuthenticatedSubject.next(true);
        this.userSubject.next({ username, email });
      })
    );
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_email');
    
    this.isAuthenticatedSubject.next(false);
    this.userSubject.next(null);
  }

  createChat(label: string = 'Nouvelle discussion'): Observable<any> {
    return this.http.post(`${this.baseUrl}/session`, {
      token: localStorage.getItem('auth_token'),
      label: label
    });
  }

  getChats(): Observable<any> {
    return this.http.get(`${this.baseUrl}/sessions`, {
      headers: this.getAuthHeaders()
    });
  }

  getChatHistory(chatId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/history/${chatId}`, {
      headers: this.getAuthHeaders()
    });
  }

  askQuestion(chatId: string, question: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/ask`, {
      session_id: chatId,
      question: question
    });
  }

deleteChat(chatId: string): Observable<any> {
  return this.http.delete(`${this.baseUrl}/session/${chatId}`, {
    headers: this.getAuthHeaders()
  });
}
}
