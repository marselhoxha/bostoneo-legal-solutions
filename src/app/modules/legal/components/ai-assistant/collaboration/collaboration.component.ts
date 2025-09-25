import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Session {
  id: number;
  name: string;
  documentName: string;
  participants: Participant[];
  createdAt: Date;
  lastActivity: Date;
  status: 'active' | 'idle' | 'ended';
}

interface Participant {
  id: number;
  name: string;
  email: string;
  role: string;
  isOnline: boolean;
  avatar?: string;
}

interface Comment {
  id: number;
  author: string;
  text: string;
  timestamp: Date;
  resolved: boolean;
}

@Component({
  selector: 'app-collaboration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './collaboration.component.html',
  styleUrls: ['./collaboration.component.scss']
})
export class CollaborationComponent implements OnInit {
  activeSessions: Session[] = [];
  selectedSession: Session | null = null;
  comments: Comment[] = [];
  newComment = '';
  inviteEmail = '';

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(): void {
    this.activeSessions = [
      {
        id: 1,
        name: 'Motion to Dismiss Review',
        documentName: 'Motion_to_Dismiss_v3.docx',
        participants: [
          { id: 1, name: 'John Smith', email: 'john@law.com', role: 'Partner', isOnline: true },
          { id: 2, name: 'Sarah Johnson', email: 'sarah@law.com', role: 'Associate', isOnline: true },
          { id: 3, name: 'Mike Brown', email: 'mike@law.com', role: 'Paralegal', isOnline: false }
        ],
        createdAt: new Date('2024-01-20T10:00:00'),
        lastActivity: new Date('2024-01-20T14:30:00'),
        status: 'active'
      },
      {
        id: 2,
        name: 'Contract Negotiation',
        documentName: 'Purchase_Agreement.docx',
        participants: [
          { id: 4, name: 'Emily Davis', email: 'emily@law.com', role: 'Partner', isOnline: false },
          { id: 5, name: 'Robert Wilson', email: 'robert@law.com', role: 'Associate', isOnline: false }
        ],
        createdAt: new Date('2024-01-19T15:00:00'),
        lastActivity: new Date('2024-01-19T17:45:00'),
        status: 'idle'
      }
    ];
  }

  selectSession(session: Session): void {
    this.selectedSession = session;
    this.loadComments();
  }

  createSession(): void {
    const newSession: Session = {
      id: Date.now(),
      name: 'New Document Session',
      documentName: 'Untitled.docx',
      participants: [
        { id: 1, name: 'Current User', email: 'user@law.com', role: 'Owner', isOnline: true }
      ],
      createdAt: new Date(),
      lastActivity: new Date(),
      status: 'active'
    };
    this.activeSessions.unshift(newSession);
  }

  inviteParticipant(): void {
    if (!this.inviteEmail || !this.selectedSession) return;
    console.log('Inviting:', this.inviteEmail);
    this.inviteEmail = '';
  }

  loadComments(): void {
    this.comments = [
      { id: 1, author: 'John Smith', text: 'Please review the jurisdiction section', timestamp: new Date('2024-01-20T14:00:00'), resolved: false },
      { id: 2, author: 'Sarah Johnson', text: 'Updated the case citations', timestamp: new Date('2024-01-20T14:15:00'), resolved: true },
      { id: 3, author: 'Mike Brown', text: 'Formatting needs adjustment on page 3', timestamp: new Date('2024-01-20T14:30:00'), resolved: false }
    ];
  }

  addComment(): void {
    if (!this.newComment.trim()) return;

    const comment: Comment = {
      id: Date.now(),
      author: 'Current User',
      text: this.newComment,
      timestamp: new Date(),
      resolved: false
    };
    this.comments.push(comment);
    this.newComment = '';
  }

  toggleResolve(comment: Comment): void {
    comment.resolved = !comment.resolved;
  }

  endSession(session: Session): void {
    session.status = 'ended';
    this.activeSessions = this.activeSessions.filter(s => s.id !== session.id);
    if (this.selectedSession?.id === session.id) {
      this.selectedSession = null;
    }
  }
}