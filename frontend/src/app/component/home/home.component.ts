import { Component, OnInit } from '@angular/core';
import { ChatbotService } from 'src/app/service/chatbot.service';

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  userMessage: string = '';
  chatMessages: ChatMessage[] = [];
  chatId: string = '';
  
  isSidebarOpen: boolean = true;
  isDarkTheme: boolean = false;
  isLoggedIn: boolean = false;
  userName: string = '';
  userEmail: string = '';
  
  chatHistory: any[] = [];
  currentChatId: string = '';

  showLoginForm: boolean = false;
  loginEmail: string = '';
  loginPassword: string = '';
  registerUsername: string = '';
  registerEmail: string = '';
  registerPassword: string = '';
  isRegistering: boolean = false;
  authError: string = '';

  constructor(private chatbotService: ChatbotService) { }

  ngOnInit(): void {
    this.initTheme();
    
    this.checkScreenSize();
    
    this.checkLoginStatus();
    
    this.chatbotService.isAuthenticated$.subscribe(isAuthenticated => {
      this.isLoggedIn = isAuthenticated;
      if (isAuthenticated) {
        this.loadUserInfo();
        this.loadChats();
      } else {
        this.chatHistory = [];
        this.chatMessages = [];
        this.chatId = '';
        this.currentChatId = '';
      }
    });
  }

  private initTheme(): void {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme) {
      this.isDarkTheme = savedTheme === 'dark';
    } else {
      this.isDarkTheme = prefersDark;
    }
  }

  private checkScreenSize(): void {
    if (window.innerWidth < 768) {
      this.isSidebarOpen = false;
    }
    
    window.addEventListener('resize', () => {
      if (window.innerWidth < 768) {
        this.isSidebarOpen = false;
      }
    });
  }

  private checkLoginStatus(): void {
    const token = localStorage.getItem('auth_token');
    this.isLoggedIn = !!token;
    
    if (this.isLoggedIn) {
      this.loadUserInfo();
      this.loadChats();
    }
  }

  private loadUserInfo(): void {
    this.userName = localStorage.getItem('user_name') || '';
    this.userEmail = localStorage.getItem('user_email') || '';
  }

  private loadChats(): void {
    this.chatbotService.getChats().subscribe({
      next: (response) => {
        this.chatHistory = response.sessions;
        
        if (this.chatHistory.length > 0 && !this.currentChatId) {
          this.selectChat(this.chatHistory[0].session_id);
        }
      },
      error: (err) => {
        console.error("Erreur lors du chargement des chats :", err);
      }
    });
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');
  }

  startNewChat(): void {
    this.chatMessages = [];
    
    if (!this.isLoggedIn) {
      this.showLoginForm = true;
      return;
    }
    
    this.chatbotService.createChat().subscribe({
      next: (response) => {
        this.chatId = response.session_id;
        this.currentChatId = this.chatId;
        
        this.loadChats();
      },
      error: (err) => {
        console.error("Erreur lors de la création du chat :", err);
      }
    });
  }

  selectChat(chatId: string): void {
    this.currentChatId = chatId;
    this.chatId = chatId;
    
    this.chatbotService.getChatHistory(chatId).subscribe({
      next: (response) => {
        this.chatMessages = response.history.map((msg: any) => {
          return {
            sender: msg.role === 'user' ? 'user' : 'bot',
            text: msg.content,
            timestamp: new Date(msg.timestamp)
          };
        });
      },
      error: (err) => {
        console.error("Erreur lors du chargement de l'historique :", err);
        this.chatMessages = [];
      }
    });
  }

  sendMessage(): void {
    if (!this.userMessage.trim()) { return; }

    if (!this.isLoggedIn) {
      this.showLoginForm = true;
      return;
    }

    if (!this.chatId) {
      this.startNewChat();
      return;
    }

    const userChat: ChatMessage = {
      sender: 'user',
      text: this.userMessage.trim(),
      timestamp: new Date()
    };
    this.chatMessages.push(userChat);

    const question = this.userMessage.trim();
    this.userMessage = '';

    this.chatbotService.askQuestion(this.chatId, question).subscribe({
      next: (res: { answer: any; }) => {
        const botChat: ChatMessage = {
          sender: 'bot',
          text: res.answer,
          timestamp: new Date()
        };
        this.chatMessages.push(botChat);
        
        this.loadChats();
      },
      error: (err: any) => {
        console.error("Erreur lors de l'envoi de la question :", err);
        const errorChat: ChatMessage = {
          sender: 'bot',
          text: "Erreur lors de la communication avec le serveur.",
          timestamp: new Date()
        };
        this.chatMessages.push(errorChat);
      }
    });
  }

  setQuestion(question: string): void {
    this.userMessage = question;
  }

  openLoginForm(): void {
    this.showLoginForm = true;
    this.isRegistering = false;
    this.authError = '';
  }

  toggleRegister(): void {
    this.isRegistering = !this.isRegistering;
    this.authError = '';
  }

  closeLoginForm(): void {
    this.showLoginForm = false;
    this.authError = '';
  }

  login(): void {
    if (!this.loginEmail || !this.loginPassword) {
      this.authError = "Veuillez remplir tous les champs";
      return;
    }

    this.chatbotService.login(this.loginEmail, this.loginPassword).subscribe({
      next: () => {
        this.showLoginForm = false;
        this.loginEmail = '';
        this.loginPassword = '';
        this.authError = '';
      },
      error: (err) => {
        console.error("Erreur de connexion:", err);
        this.authError = "Identifiants incorrects";
      }
    });
  }

  register(): void {
    if (!this.registerUsername || !this.registerEmail || !this.registerPassword) {
      this.authError = "Veuillez remplir tous les champs";
      return;
    }

    this.chatbotService.register(
      this.registerUsername,
      this.registerEmail,
      this.registerPassword
    ).subscribe({
      next: () => {
        this.loginEmail = this.registerEmail;
        this.loginPassword = this.registerPassword;
        this.login();
      },
      error: (err) => {
        console.error("Erreur d'inscription:", err);
        this.authError = "Erreur lors de l'inscription. Cet email est peut-être déjà utilisé.";
      }
    });
  }

  logout(): void {
    this.chatbotService.logout();
  }

deleteChat(chatId: string, event?: Event): void {
  if (event) {
    event.stopPropagation();
  }
  
  if (!confirm("Êtes-vous sûr de vouloir supprimer cette conversation ?")) {
    return;
  }
  
  this.chatbotService.deleteChat(chatId).subscribe({
    next: () => {
      if (this.currentChatId === chatId) {
        this.chatMessages = [];
        this.currentChatId = '';
        this.chatId = '';
      }
      
      this.loadChats();
    },
    error: (err) => {
      console.error("Erreur lors de la suppression du chat :", err);
      alert("Erreur lors de la suppression du chat");
    }
  });
}
}