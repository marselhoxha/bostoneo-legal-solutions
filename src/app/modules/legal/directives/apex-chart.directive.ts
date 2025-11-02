import { Directive, ElementRef, AfterViewInit, OnDestroy, inject } from '@angular/core';
import * as ApexCharts from 'apexcharts';
import { ApexOptions } from 'apexcharts';
import { ChartSecurityService } from '../services/chart-security.service';

interface ChartDataConfig {
  type: 'bar' | 'pie' | 'donut' | 'line';
  title?: string;
  subtitle?: string;
  data: any[];
  labels?: string[];
  colors?: string[];
}

/**
 * Directive that monitors innerHTML changes and initializes ApexCharts
 * Works with [innerHTML] binding by observing DOM mutations
 * SECURITY: Validates and sanitizes all chart data before rendering
 */
@Directive({
  selector: '[apexChartsContainer]',
  standalone: true
})
export class ApexChartDirective implements AfterViewInit, OnDestroy {
  private charts: any[] = [];
  private mutationObserver: MutationObserver | null = null;
  private chartSecurity = inject(ChartSecurityService);

  // Velzon theme colors (matching current design)
  private readonly velzonColors = [
    '#405189', // primary
    '#0ab39c', // success
    '#f06548', // danger
    '#299cdb', // info
    '#f7b84b', // warning
    '#74788d'  // secondary
  ];

  constructor(private el: ElementRef) {}

  ngAfterViewInit(): void {
    // Initialize existing charts
    setTimeout(() => {
      this.initializeCharts();
      this.setupMutationObserver();
    }, 100);
  }

  ngOnDestroy(): void {
    this.destroyAllCharts();
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
  }

  /**
   * Find all chart divs and initialize them
   */
  private initializeCharts(): void {
    const chartElements = this.el.nativeElement.querySelectorAll('[data-chart]');
    chartElements.forEach((element: HTMLElement) => {
      if (!element.hasAttribute('data-chart-initialized')) {
        this.initializeChart(element);
        element.setAttribute('data-chart-initialized', 'true');
      }
    });
  }

  /**
   * Setup MutationObserver to detect new chart elements added via innerHTML
   */
  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          // Small delay to let Angular finish rendering
          setTimeout(() => this.initializeCharts(), 50);
        }
      });
    });

    this.mutationObserver.observe(this.el.nativeElement, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Initialize a single chart element
   * SECURITY: Validates and sanitizes config before rendering
   */
  private initializeChart(element: HTMLElement): void {
    let configStr: string | null = null;

    try {
      configStr = element.getAttribute('data-chart');

      if (!configStr) {
        console.warn('ApexChart: No chart configuration found');
        return;
      }

      // Decode HTML entities
      const decodedConfig = configStr.replace(/&quot;/g, '"');

      // SECURITY: Validate and sanitize configuration (defense in depth)
      const config: ChartDataConfig = this.chartSecurity.validateAndSanitize(decodedConfig);

      // Additional security check: detect suspicious patterns
      const configAsString = JSON.stringify(config);
      if (this.chartSecurity.detectSuspiciousPatterns(configAsString)) {
        console.error('ApexChart: Suspicious content detected, rendering blocked');
        element.innerHTML = '<div class="alert alert-warning">Chart contains invalid data</div>';
        return;
      }

      // VALIDATION: Check for valid data before rendering
      if (!config.data || !Array.isArray(config.data) || config.data.length === 0) {
        console.error('ApexChart: No valid data to render');
        element.innerHTML = '<div class="alert alert-info">No data available for chart</div>';
        return;
      }

      // Build ApexCharts options based on chart type
      const options = this.buildChartOptions(config);

      // Initialize chart
      const chart = new (ApexCharts as any).default(element, options);
      chart.render();

      // Store chart reference for cleanup
      this.charts.push(chart);

    } catch (error) {
      console.error('ApexChart initialization error:', error);
      element.innerHTML = '<div class="alert alert-danger">Unable to render chart</div>';
    }
  }

  private buildChartOptions(config: ChartDataConfig): ApexOptions {
    const isDarkMode = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const colors = config.colors || this.velzonColors;

    const baseOptions: ApexOptions = {
      chart: {
        fontFamily: 'inherit',
        foreColor: isDarkMode ? '#ced4da' : '#495057',
        toolbar: {
          show: false
        },
        background: 'transparent'
      },
      theme: {
        mode: isDarkMode ? 'dark' : 'light'
      },
      colors: colors,
      grid: {
        borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        strokeDashArray: 3
      },
      tooltip: {
        theme: isDarkMode ? 'dark' : 'light',
        style: {
          fontSize: '12px',
          fontFamily: 'inherit'
        }
      }
    };

    // Chart-type specific configurations
    switch (config.type) {
      case 'bar':
        return this.buildBarChartOptions(config, baseOptions);
      case 'pie':
      case 'donut':
        return this.buildPieChartOptions(config, baseOptions);
      case 'line':
        return this.buildLineChartOptions(config, baseOptions);
      default:
        return baseOptions;
    }
  }

  private buildBarChartOptions(config: ChartDataConfig, baseOptions: ApexOptions): ApexOptions {
    // Extract and validate numeric data
    const seriesData = config.data.map((item: any) => {
      const value = typeof item === 'object' ? (item.value || 0) : (item || 0);
      return isNaN(value) ? 0 : value;
    });

    return {
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        type: 'bar',
        height: 300,
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800
        }
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '60%',
          borderRadius: 6,
          dataLabels: {
            position: 'top'
          }
        }
      },
      dataLabels: {
        enabled: false
      },
      series: [{
        name: config.subtitle || 'Value',
        data: seriesData
      }],
      xaxis: {
        categories: config.labels || config.data.map((item: any) => item.label || item.name),
        labels: {
          style: {
            fontSize: '12px'
          }
        }
      },
      yaxis: {
        labels: {
          formatter: (val: number) => {
            // Format large numbers (no currency symbol - suitable for legal metrics)
            if (val >= 1000) {
              return (val / 1000).toFixed(1) + 'K';
            }
            return val.toFixed(0);
          }
        }
      },
      title: config.title ? {
        text: config.title,
        style: {
          fontSize: '15px',
          fontWeight: 600
        }
      } : undefined,
      subtitle: config.subtitle ? {
        text: config.subtitle,
        style: {
          fontSize: '12px',
          fontWeight: 400
        }
      } : undefined
    };
  }

  private buildPieChartOptions(config: ChartDataConfig, baseOptions: ApexOptions): ApexOptions {
    // Extract and validate numeric data
    const seriesData = config.data.map((item: any) => {
      const value = typeof item === 'object' ? (item.value || item.percentage || 0) : (item || 0);
      return isNaN(value) ? 0 : value;
    });

    return {
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        type: config.type === 'donut' ? 'donut' : 'pie',
        height: 350,
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800
        }
      },
      series: seriesData,
      labels: config.labels || config.data.map((item: any) => item.label || item.name),
      legend: {
        position: 'bottom',
        fontSize: '12px',
        markers: {
          size: 6,
          offsetX: 0,
          offsetY: 0
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => val.toFixed(1) + '%',
        style: {
          fontSize: '12px',
          fontWeight: 600
        }
      },
      plotOptions: {
        pie: {
          donut: config.type === 'donut' ? {
            size: '70%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Total',
                fontSize: '14px',
                fontWeight: 600
              }
            }
          } : undefined
        }
      },
      title: config.title ? {
        text: config.title,
        style: {
          fontSize: '15px',
          fontWeight: 600
        }
      } : undefined,
      subtitle: config.subtitle ? {
        text: config.subtitle,
        style: {
          fontSize: '12px',
          fontWeight: 400
        }
      } : undefined
    };
  }

  private buildLineChartOptions(config: ChartDataConfig, baseOptions: ApexOptions): ApexOptions {
    // Extract and validate numeric data
    const data = config.data.map((item: any) => {
      const value = typeof item === 'object' ? (item.value || 0) : (item || 0);
      return isNaN(value) ? 0 : value;
    });
    const seriesColors = data.map((val: number, index: number) => {
      if (index === 0) return this.velzonColors[0]; // First point - primary
      const prevVal = data[index - 1];
      if (val > prevVal) return this.velzonColors[1]; // Increase - success/green
      if (val < prevVal) return this.velzonColors[2]; // Decrease - danger/red
      return this.velzonColors[0]; // Stable - primary
    });

    return {
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        type: 'line',
        height: 300,
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800
        },
        zoom: {
          enabled: true
        }
      },
      stroke: {
        width: 3,
        curve: 'smooth'
      },
      markers: {
        size: 5,
        colors: seriesColors,
        strokeColors: '#fff',
        strokeWidth: 2,
        hover: {
          size: 7
        }
      },
      series: [{
        name: config.subtitle || 'Value',
        data: data
      }],
      xaxis: {
        categories: config.labels || config.data.map((item: any) => item.label || item.year),
        labels: {
          style: {
            fontSize: '12px'
          }
        }
      },
      yaxis: {
        labels: {
          formatter: (val: number) => {
            // Format large numbers
            if (val >= 1000) {
              return (val / 1000).toFixed(0) + 'K';
            }
            return val.toFixed(0);
          }
        }
      },
      grid: {
        borderColor: baseOptions.grid?.borderColor,
        strokeDashArray: 3,
        xaxis: {
          lines: {
            show: false
          }
        },
        yaxis: {
          lines: {
            show: true
          }
        }
      },
      title: config.title ? {
        text: config.title,
        style: {
          fontSize: '15px',
          fontWeight: 600
        }
      } : undefined,
      subtitle: config.subtitle ? {
        text: config.subtitle,
        style: {
          fontSize: '12px',
          fontWeight: 400
        }
      } : undefined
    };
  }

  /**
   * Destroy all charts and clean up
   */
  private destroyAllCharts(): void {
    this.charts.forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
    this.charts = [];
  }
}
