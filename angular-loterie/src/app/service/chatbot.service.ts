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
  // URL de base vers ton backend Flask
  private baseUrl = 'http://localhost:5000';
  
  // BehaviorSubject pour gérer l'état de connexion
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  // User info
  private userSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
  currentUser$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) { }

  // Vérifier si un token existe
  private hasToken(): boolean {
    return !!localStorage.getItem('auth_token');
  }

  // Récupérer les informations utilisateur du localStorage
  private getUserFromStorage(): User | null {
    const username = localStorage.getItem('user_name');
    const email = localStorage.getItem('user_email');
    
    if (username && email) {
      return { username, email };
    }
    
    return null;
  }

  // Obtenir les headers d'authentification
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Inscription
  register(username: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/register`, {
      username,
      email,
      password
    });
  }

  // Connexion
  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/login`, {
      email,
      password
    }).pipe(
      tap((response: any) => {
        // Stocker le token et mettre à jour l'état d'authentification
        localStorage.setItem('auth_token', response.token);
        
        // Stocker les informations utilisateur (à implémenter côté backend)
        // Idéalement, le backend devrait renvoyer ces informations avec le token
        localStorage.setItem('user_email', email);
        // Pour l'instant, on utilise l'email comme nom d'utilisateur
        const username = email.split('@')[0];
        localStorage.setItem('user_name', username);
        
        this.isAuthenticatedSubject.next(true);
        this.userSubject.next({ username, email });
      })
    );
  }

  // Déconnexion
  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_email');
    
    this.isAuthenticatedSubject.next(false);
    this.userSubject.next(null);
  }

  // Créer un nouveau chat
  createChat(label: string = 'Nouvelle discussion'): Observable<any> {
    return this.http.post(`${this.baseUrl}/session`, {
      token: localStorage.getItem('auth_token'),
      label: label
    });
  }

  // Récupérer tous les chats de l'utilisateur
  getChats(): Observable<any> {
    return this.http.get(`${this.baseUrl}/sessions`, {
      headers: this.getAuthHeaders()
    });
  }

  // Récupérer l'historique des messages d'un chat
  getChatHistory(chatId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/history/${chatId}`, {
      headers: this.getAuthHeaders()
    });
  }

  // Poser une question
  askQuestion(chatId: string, question: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/ask`, {
      session_id: chatId,
      question: question
    });
  }
}