import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule
  ],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="sidenav.toggle()">
        <mat-icon>menu</mat-icon>
      </button>
      <span>TLS-MCP Coordinator</span>
    </mat-toolbar>

    <mat-sidenav-container>
      <mat-sidenav #sidenav mode="side" opened>
        <mat-nav-list class="nav-list">
          <a mat-list-item routerLink="/dashboard" routerLinkActive="active" class="nav-item">
            <mat-icon matListItemIcon>dashboard</mat-icon>
            <span matListItemTitle>Dashboard</span>
          </a>
          <a mat-list-item routerLink="/sessions" routerLinkActive="active" class="nav-item">
            <mat-icon matListItemIcon>list</mat-icon>
            <span matListItemTitle>Sessions</span>
          </a>
          <a mat-list-item routerLink="/key-generation" routerLinkActive="active" class="nav-item">
            <mat-icon matListItemIcon>vpn_key</mat-icon>
            <span matListItemTitle>Key Generation</span>
          </a>
          <a mat-list-item routerLink="/signature" routerLinkActive="active" class="nav-item">
            <mat-icon matListItemIcon>edit</mat-icon>
            <span matListItemTitle>Signature</span>
          </a>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <div class="content">
          <router-outlet></router-outlet>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'TLS-MCP Coordinator';
} 