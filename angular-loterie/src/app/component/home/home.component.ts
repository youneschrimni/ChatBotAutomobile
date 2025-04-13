import { Component, OnInit } from '@angular/core';
import { ChatbotService, ChatHistory } from 'src/app/service/chatbot.service';

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
  
  // Propriétés pour l'interface améliorée
  isSidebarOpen: boolean = true;
  isDarkTheme: boolean = false;
  isLoggedIn: boolean = false;
  userName: string = '';
  userEmail: string = '';
  
  // Historique des chats (pour la sidebar)
  chatHistory: any[] = [];
  currentChatId: string = '';

  // Authentification
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
    // Initialisation du thème selon les préférences de l'utilisateur
    this.initTheme();
    
    // Vérifie si l'écran est petit pour fermer la sidebar par défaut
    this.checkScreenSize();
    
    // Vérifier le statut de connexion
    this.checkLoginStatus();
    
    // S'abonner aux changements d'authentification
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
    // Vérifier les préférences système pour le thème sombre
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    // Vérifier si l'utilisateur a déjà défini une préférence
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
    
    // Écouter les changements de taille d'écran
    window.addEventListener('resize', () => {
      if (window.innerWidth < 768) {
        this.isSidebarOpen = false;
      }
    });
  }

  private checkLoginStatus(): void {
    // Vérifier si un token est présent dans le localStorage
    const token = localStorage.getItem('auth_token');
    this.isLoggedIn = !!token;
    
    if (this.isLoggedIn) {
      this.loadUserInfo();
      this.loadChats();
    }
  }

  private loadUserInfo(): void {
    // Charger les informations de l'utilisateur depuis le localStorage
    this.userName = localStorage.getItem('user_name') || '';
    this.userEmail = localStorage.getItem('user_email') || '';
  }

  private loadChats(): void {
    this.chatbotService.getChats().subscribe({
      next: (response) => {
        this.chatHistory = response.sessions;
        
        // Si aucun chat n'est sélectionné et qu'il y a des chats disponibles, sélectionner le premier
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
    // Réinitialiser les messages
    this.chatMessages = [];
    
    if (!this.isLoggedIn) {
      this.showLoginForm = true;
      return;
    }
    
    // Créer un nouveau chat
    this.chatbotService.createChat().subscribe({
      next: (response) => {
        this.chatId = response.session_id;
        this.currentChatId = this.chatId;
        
        // Recharger la liste des chats pour afficher le nouveau
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
    
    // Charger l'historique des messages pour ce chat
    this.chatbotService.getChatHistory(chatId).subscribe({
      next: (response) => {
        // Transformer les messages du format backend au format frontend
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
      // Si aucun chat n'est actif, en créer un nouveau
      this.startNewChat();
      return;
    }

    // Ajoute le message de l'utilisateur dans la conversation
    const userChat: ChatMessage = {
      sender: 'user',
      text: this.userMessage.trim(),
      timestamp: new Date()
    };
    this.chatMessages.push(userChat);

    const question = this.userMessage.trim();
    this.userMessage = '';

    // Envoie la question au backend et affiche la réponse du chatbot
    this.chatbotService.askQuestion(this.chatId, question).subscribe({
      next: (res: { answer: any; }) => {
        const botChat: ChatMessage = {
          sender: 'bot',
          text: res.answer,
          timestamp: new Date()
        };
        this.chatMessages.push(botChat);
        
        // Recharger la liste des chats pour mettre à jour les titres/derniers messages
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

  // Montrer le formulaire de connexion
  openLoginForm(): void {
    this.showLoginForm = true;
    this.isRegistering = false;
    this.authError = '';
  }

  // Basculer entre connexion et inscription
  toggleRegister(): void {
    this.isRegistering = !this.isRegistering;
    this.authError = '';
  }

  // Fermer le formulaire de connexion
  closeLoginForm(): void {
    this.showLoginForm = false;
    this.authError = '';
  }

  // Gérer la connexion
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

  // Gérer l'inscription
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
        // Après l'inscription réussie, connecter l'utilisateur
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

  // Gérer la déconnexion
  logout(): void {
    this.chatbotService.logout();
  }
}