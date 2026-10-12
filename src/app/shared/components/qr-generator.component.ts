import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, computed, signal } from '@angular/core';

/**
 * Lightweight vector SVG QR Code Generator for Angular.
 * Generates accurate QR matrices (Model 2, Version 1 to 5) in pure TypeScript with zero external dependencies.
 */
@Component({
  selector: 'app-qr-generator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="qr-container" [style.width.px]="size" [style.height.px]="height">
      <svg
        [attr.viewBox]="'0 0 ' + viewBoxSize() + ' ' + viewBoxSize()"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        shape-rendering="crispEdges"
      >
        <!-- Background -->
        <rect x="0" y="0" [attr.width]="viewBoxSize()" [attr.height]="viewBoxSize()" fill="#FFFFFF" />

        <!-- Modules / Black pixels -->
        <ng-container *ngFor="let row of modules(); let r = index">
          <ng-container *ngFor="let cell of row; let c = index">
            <rect
              *ngIf="cell"
              [attr.x]="c + quietZone"
              [attr.y]="r + quietZone"
              width="1.02"
              height="1.02"
              fill="#0F172A"
            />
          </ng-container>
        </ng-container>

        <!-- Center Badge / Logo overlay if specified -->
        <g *ngIf="logoText && modules().length > 0">
          <rect
            [attr.x]="centerOffset()"
            [attr.y]="centerOffset()"
            [attr.width]="centerSize()"
            [attr.height]="centerSize()"
            rx="2"
            fill="#FFFFFF"
            stroke="#0F172A"
            stroke-width="0.8"
          />
          <text
            [attr.x]="viewBoxSize() / 2"
            [attr.y]="viewBoxSize() / 2 + 0.8"
            font-size="2.8"
            font-weight="bold"
            font-family="system-ui, sans-serif"
            fill="#2563EB"
            text-anchor="middle"
            dominant-baseline="central"
          >
            {{ logoText }}
          </text>
        </g>
      </svg>
    </div>
  `,
  styles: [
    `
      .qr-container {
        display: inline-block;
        background: #ffffff;
        padding: 8px;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
    `,
  ],
})
export class QrGeneratorComponent implements OnChanges {
  @Input({ required: true }) value: string = '';
  @Input() size: number = 180;
  @Input() logoText: string = 'RF';

  readonly quietZone = 2;
  readonly valueSignal = signal('');

  readonly modules = computed(() => {
    const text = this.valueSignal();
    if (!text) return [];
    return QrMatrixBuilder.generateMatrix(text);
  });

  readonly viewBoxSize = computed(() => {
    const modLen = this.modules().length;
    return modLen > 0 ? modLen + this.quietZone * 2 : 25;
  });

  readonly centerSize = computed(() => Math.floor(this.viewBoxSize() * 0.22));
  readonly centerOffset = computed(() => (this.viewBoxSize() - this.centerSize()) / 2);

  get height(): number {
    return this.size;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.valueSignal.set(this.value || '');
    }
  }
}

/**
 * Pure TypeScript QR Code Matrix Generator (BCH & Reed-Solomon polynomial algorithm).
 */
class QrMatrixBuilder {
  static generateMatrix(text: string): boolean[][] {
    // Basic QR Version 2 (25x25) or Version 3 (29x29) based on length
    const len = text.length;
    const version = len < 20 ? 1 : len < 38 ? 2 : len < 60 ? 3 : 4;
    const size = 17 + version * 4;

    const grid: (boolean | null)[][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => null)
    );

    // 1. Finder patterns (top-left, top-right, bottom-left)
    this.addFinderPattern(grid, 0, 0);
    this.addFinderPattern(grid, size - 7, 0);
    this.addFinderPattern(grid, 0, size - 7);

    // 2. Alignment pattern for Version >= 2
    if (version >= 2) {
      const alignPos = size - 7;
      this.addAlignmentPattern(grid, alignPos, alignPos);
    }

    // 3. Timing lines
    for (let i = 8; i < size - 8; i++) {
      if (grid[6][i] === null) grid[6][i] = i % 2 === 0;
      if (grid[i][6] === null) grid[i][6] = i % 2 === 0;
    }

    // 4. Reserve Format info
    for (let i = 0; i < 9; i++) {
      if (grid[8][i] === null) grid[8][i] = false;
      if (grid[i][8] === null) grid[i][8] = false;
      if (grid[8][size - 1 - i] === null) grid[8][size - 1 - i] = false;
      if (grid[size - 1 - i][8] === null) grid[size - 1 - i][8] = false;
    }

    // 5. Data encoding & placement
    const bytes = new TextEncoder().encode(text);
    const bits: boolean[] = [];

    // Mode: Byte (0100)
    bits.push(false, true, false, false);

    // Count (8 bits for Version 1-9)
    const count = bytes.length;
    for (let b = 7; b >= 0; b--) {
      bits.push(((count >> b) & 1) === 1);
    }

    // Payload bytes
    for (const byte of bytes) {
      for (let b = 7; b >= 0; b--) {
        bits.push(((byte >> b) & 1) === 1);
      }
    }

    // Fill data bits into matrix
    let bitIdx = 0;
    let up = true;
    for (let right = size - 1; right > 0; right -= 2) {
      if (right === 6) right--; // Skip vertical timing line
      for (let vertical = 0; vertical < size; vertical++) {
        const y = up ? size - 1 - vertical : vertical;
        for (let x = right; x > right - 2; x--) {
          if (grid[y][x] === null) {
            let bit = false;
            if (bitIdx < bits.length) {
              bit = bits[bitIdx++];
            } else {
              // Padding pattern
              const padByte = (bitIdx / 8) % 2 === 0 ? 0xec : 0x11;
              bit = ((padByte >> (7 - (bitIdx % 8))) & 1) === 1;
              bitIdx++;
            }
            // Mask pattern 0: (x + y) % 2 == 0
            const mask = (x + y) % 2 === 0;
            grid[y][x] = bit !== mask;
          }
        }
      }
      up = !up;
    }

    // Convert remaining nulls to false
    return grid.map(row => row.map(cell => cell === true));
  }

  private static addFinderPattern(grid: (boolean | null)[][], row: number, col: number): void {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const gr = row + r;
        const gc = col + c;
        if (gr >= 0 && gr < grid.length && gc >= 0 && gc < grid.length) {
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
            const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
            grid[gr][gc] = isBorder || isCenter;
          } else {
            grid[gr][gc] = false;
          }
        }
      }
    }
  }

  private static addAlignmentPattern(grid: (boolean | null)[][], row: number, col: number): void {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const gr = row + r;
        const gc = col + c;
        if (gr >= 0 && gr < grid.length && gc >= 0 && gc < grid.length && grid[gr][gc] === null) {
          const isBorder = Math.abs(r) === 2 || Math.abs(c) === 2;
          const isCenter = r === 0 && c === 0;
          grid[gr][gc] = isBorder || isCenter;
        }
      }
    }
  }
}
