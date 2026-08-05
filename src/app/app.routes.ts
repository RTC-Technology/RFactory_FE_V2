import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/users/users.component').then(m => m.UsersComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['users.view'] },
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/settings/settings.component').then(m => m.SettingsComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['settings.manage'] },
      },
      {
        path: 'factory-structure',
        loadComponent: () =>
          import('./pages/factory-structure/factory-structure.component').then(m => m.FactoryStructureComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['masterdata.manage'] },
      },
      {
        path: 'menu-manager',
        loadComponent: () =>
          import('./pages/menu-manager/menu-manager.component').then(m => m.MenuManagerComponent),
        canActivate: [permissionGuard],
        data: { permissions: ['menu.manage'] },
      },

      {
        path: 'forbidden',
        loadComponent: () => import('./pages/forbidden/forbidden.component').then(m => m.ForbiddenComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
