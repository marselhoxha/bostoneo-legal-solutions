import { Directive, ElementRef, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';

@Directive({
  selector: '[countUp]'
})
export class CountUpDirective implements OnInit, OnChanges {
  @Input('countUp') targetValue: number = 0;
  @Input() duration: number = 1000;
  @Input() useEasing: boolean = true;
  @Input() useGrouping: boolean = true;
  @Input() separator: string = ',';
  @Input() decimal: string = '.';
  @Input() decimalPlaces: number = 0;

  private startValue: number = 0;
  private startTime: number = 0;
  private rafId: number | null = null;

  constructor(private el: ElementRef) {}

  ngOnInit(): void {
    this.animate();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['targetValue'] && !changes['targetValue'].firstChange) {
      this.startValue = parseInt(this.el.nativeElement.innerText, 10) || 0;
      this.animate();
    }
  }

  private animate(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    this.startTime = performance.now();
    this.updateValue();
  }

  private updateValue(): void {
    const currentTime = performance.now();
    const elapsedTime = currentTime - this.startTime;
    
    if (elapsedTime < this.duration) {
      let value = this.startValue;
      
      if (this.useEasing) {
        // Easing function: easeOutExpo
        const progress = 1 - Math.pow(2, -10 * elapsedTime / this.duration);
        value = this.startValue + (this.targetValue - this.startValue) * progress;
      } else {
        // Linear
        value = this.startValue + (this.targetValue - this.startValue) * (elapsedTime / this.duration);
      }

      this.el.nativeElement.innerText = this.formatNumber(value);
      this.rafId = requestAnimationFrame(() => this.updateValue());
    } else {
      this.el.nativeElement.innerText = this.formatNumber(this.targetValue);
      this.rafId = null;
    }
  }

  private formatNumber(value: number): string {
    const roundedValue = Number(Math.round(parseFloat(value + 'e' + this.decimalPlaces)) + 'e-' + this.decimalPlaces);
    const parts = roundedValue.toFixed(this.decimalPlaces).split('.');
    
    if (this.useGrouping) {
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, this.separator);
    }
    
    return parts.join(this.decimal);
  }
} 
 
 