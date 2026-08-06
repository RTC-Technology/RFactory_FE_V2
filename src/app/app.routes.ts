import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { PERMISSIONS } from './core/auth/permissions';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
    // Never cached: it is not a tab, and TabReuseStrategy would otherwise hand the next
    // visit the same instance the previous sign-in left mid-submit.
    data: { reuse: false },
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        // Deliberately ungated: it is the landing route every redirect falls back to, so
        // gating it would leave a user with no permissions bouncing between here and
        // /forbidden.
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        // Organization/user declaration. Kept on `/users` rather than redirecting from
        // an `/organizations` alias: a redirect would leave TabService opening one tab
        // for the requested route and a second for the settled one.
        // Organization/user declaration. The screen reads both, so it needs both view
        // codes — `permissionMode: 'all'`, since holding only one would leave a panel
        // permanently erroring on 403.
        path: 'users',
        loadComponent: () =>
          import('./pages/organization/organization.component').then(m => m.OrganizationComponent),
        canActivate: [permissionGuard],
        data: {
          permissions: [PERMISSIONS.organization.view, PERMISSIONS.user.view],
          permissionMode: 'all',
        },
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/settings/settings.component').then(m => m.SettingsComponent),
        canActivate: [permissionGuard],
        data: { permissions: [PERMISSIONS.settings.view] },
      },
      {
        path: 'factory-structure',
        loadComponent: () =>
          import('./pages/factory-structure/factory-structure.component').then(m => m.FactoryStructureComponent),
        canActivate: [permissionGuard],
        data: {
          permissions: [PERMISSIONS.factory.view, PERMISSIONS.area.view, PERMISSIONS.line.view],
          permissionMode: 'all',
        },
      },
      {
        path: 'shifts',
        loadComponent: () =>
          import('./pages/shift/shift.component').then(m => m.ShiftComponent),
        canActivate: [permissionGuard],
        data: {
          permissions: [PERMISSIONS.shift.view, PERMISSIONS.shiftBreak.view],
          permissionMode: 'all',
        },
      },
      {
        // Also reads lines and areas to show and pick a machine's location.
        path: 'machines',
        loadComponent: () =>
          import('./pages/machine/machine.component').then(m => m.MachineComponent),
        canActivate: [permissionGuard],
        data: {
          permissions: [
            PERMISSIONS.machineType.view, PERMISSIONS.machine.view,
            PERMISSIONS.area.view, PERMISSIONS.line.view,
          ],
          permissionMode: 'all',
        },
      },
      {
        // Reads the permission catalogue to assign rights, and users/organizations to
        // pick members.
        path: 'user-groups',
        loadComponent: () =>
          import('./pages/user-group/user-group.component').then(m => m.UserGroupComponent),
        canActivate: [permissionGuard],
        data: {
          permissions: [
            PERMISSIONS.userGroup.view, PERMISSIONS.function.view,
            PERMISSIONS.functionGroup.view, PERMISSIONS.user.view, PERMISSIONS.organization.view,
          ],
          permissionMode: 'all',
        },
      },
      {
        // Reads menus to refuse deleting a permission a menu item still points at.
        path: 'functions',
        loadComponent: () =>
          import('./pages/function/function.component').then(m => m.FunctionComponent),
        canActivate: [permissionGuard],
        data: {
          permissions: [
            PERMISSIONS.functionGroup.view, PERMISSIONS.function.view, PERMISSIONS.menu.view,
          ],
          permissionMode: 'all',
        },
      },
      {
        // Reads the permission catalogue to gate menu items.
        path: 'menu-manager',
        loadComponent: () =>
          import('./pages/menu-manager/menu-manager.component').then(m => m.MenuManagerComponent),
        canActivate: [permissionGuard],
        data: {
          permissions: [PERMISSIONS.menu.view, PERMISSIONS.function.view],
          permissionMode: 'all',
        },
      },

      {
        path: 'forbidden',
        loadComponent: () => import('./pages/forbidden/forbidden.component').then(m => m.ForbiddenComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
