import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/server-coordinator/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'server-coordinator',
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'sessions',
        loadComponent: () =>
          import('./components/sessions/sessions.component').then(
            (m) => m.SessionsComponent
          ),
      },
      {
        path: 'sessions/:id',
        loadComponent: () =>
          import('./components/session-detail/session-detail.component').then(
            (m) => m.SessionDetailComponent
          ),
      },
      {
        path: 'key-generation',
        loadComponent: () =>
          import('./components/key-generation/key-generation.component').then(
            (m) => m.KeyGenerationComponent
          ),
      },
      {
        path: 'signature',
        loadComponent: () =>
          import('./components/signature/signature.component').then(
            (m) => m.SignatureComponent
          ),
      },
      {
        path: 'commitment-manager',
        loadComponent: () =>
          import(
            './components/commitment-manager/commitment-manager.component'
          ).then((m) => m.CommitmentManagerComponent),
      },
    ],
  },
  {
    path: 'distributed-coordinator',
    loadComponent: () =>
      import(
        './components/distributed-coordinator/distributed-coordinator.component'
      ).then((m) => m.DistributedCoordinatorComponent),
  },
  {
    path: '**',
    redirectTo: '/server-coordinator/dashboard',
  },
];
