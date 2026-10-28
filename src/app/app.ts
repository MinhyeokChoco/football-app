import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppUpdates } from './core/app-updates';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  constructor() {
    inject(AppUpdates).start();
  }
}
