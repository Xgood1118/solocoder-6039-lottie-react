import lottie, { AnimationItem } from 'lottie-web';
import * as React from 'react';

import { LOTTIE_WEB_VERSION, REACT_LOTTIE_PLAYER_VERSION } from './versions';

/**
 * Parse a resource into a JSON object or a URL string
 */
export function parseSrc(src: string | object): string | object {
  if (typeof src === 'object') {
    return src;
  }

  try {
    return JSON.parse(src);
  } catch (e) {
    // Do nothing...
  }

  // Try construct an absolute URL from the src URL
  try {
    return new URL(src).toString();
  } catch (e) {
    // Do nothing...
  }

  return src;
}

// Necessary so that we can add Lottie to the window afterwards
declare global {
  interface Window {
    lottie: any;
  }
}

// Define valid player states
export enum PlayerState {
  Loading = 'loading',
  Playing = 'playing',
  Paused = 'paused',
  Stopped = 'stopped',
  Frozen = 'frozen',
  Error = 'error',
}

// Define player events
export enum PlayerEvent {
  Load = 'load',
  InstanceSaved = 'instanceSaved',
  Error = 'error',
  Ready = 'ready',
  Play = 'play',
  Pause = 'pause',
  Stop = 'stop',
  Freeze = 'freeze',
  Loop = 'loop',
  Complete = 'complete',
  Frame = 'frame',
}

export type Versions = {
  lottieWebVersion: string;
  lottiePlayerVersion: string;
};

export type PlayerDirection = -1 | 1;

export interface Bookmark {
  id: string;
  name: string;
  note?: string;
  frame: number;
  createdAt: number;
}

export type ControlsPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface IPlayerProps {
  id?: string;
  lottieRef?: (ref: AnimationItem) => void;
  onEvent?: (event: PlayerEvent) => any;
  onStateChange?: (state: PlayerState) => any;
  onBackgroundChange?: (color: string) => void;
  autoplay?: boolean;
  background?: string;
  children?: React.ReactNode | React.ReactNode[];
  controls?: boolean;
  direction?: PlayerDirection;
  hover?: boolean;
  loop?: boolean | number;
  renderer?: any;
  speed?: number;
  src: object | string;
  style?: React.CSSProperties;
  rendererSettings?: object;
  keepLastFrame?: boolean;
  className?: string;
  onBookmarkAdd?: (bookmark: Bookmark) => void;
  onBookmarkDelete?: (bookmarkId: string) => void;
  onBookmarksChange?: (bookmarks: Bookmark[]) => void;
}

interface IPlayerState {
  animationData: any;
  background: string;
  containerRef: React.Ref<HTMLDivElement> | null;
  debug?: boolean;
  instance: AnimationItem | null;
  seeker: number;
  playerState: PlayerState;
  bookmarks: Bookmark[];
  controlsPosition: ControlsPosition;
}



// Build default config for lottie-web player
const defaultOptions = {
  clearCanvas: false,
  hideOnTransparent: true,
  progressiveLoad: true,
};

export class Player extends React.Component<IPlayerProps, IPlayerState> {
  public static async getDerivedStateFromProps(nextProps: any, prevState: any) {
    if (nextProps.background !== prevState.background) {
      return { background: nextProps.background };
    } else {
      return null;
    }
  }

  public container: Element | null = null;
  public unmounted = false;

  constructor(props: IPlayerProps) {
    super(props);

    if (typeof window !== 'undefined') {
      window.lottie = lottie;
    }
    this.state = {
      animationData: null,
      background: 'transparent',
      containerRef: React.createRef(),
      debug: true,
      instance: null,
      playerState: PlayerState.Loading,
      seeker: 0,
      bookmarks: [],
      controlsPosition: 'bottom-right',
    };
  }

  /**
   * Returns the lottie-web version and this player's version
   */
  public getVersions(): Versions {
    return {
      lottieWebVersion: LOTTIE_WEB_VERSION,
      lottiePlayerVersion: REACT_LOTTIE_PLAYER_VERSION,
    };
  }

  static defaultProps = {
    loop: false,
  };

  public async componentDidMount() {
    if (!this.unmounted) {
      await this.createLottie();
    }
  }

  public componentWillUnmount() {
    this.unmounted = true;
    if (this.state.instance) {
      this.state.instance.destroy();
    }
  }

  public async componentDidUpdate(prevProps: any) {
    if (this.props.src !== prevProps.src) {
      if (this.state.instance) {
        this.state.instance.destroy();
      }
      await this.createLottie();
    }
  }
  handleBgChange = (childData: any) => {
    this.setState({ background: childData });
  };
  triggerDownload = (dataUri: any, filename: any) => {
    const element = document.createElement('a');

    element.href = dataUri;
    element.download = filename;
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  };
  snapshot = (download = true) => {
    let data;
    const id = this.props.id ? this.props.id : 'lottie';
    const lottieElement = document.getElementById(id);
    if (this.props.renderer === 'svg') {
      // Get SVG element and serialize markup
      if (lottieElement) {
        const svgElement = lottieElement.querySelector('svg');

        if (svgElement) {
          const serializedSvg = new XMLSerializer().serializeToString(svgElement);
          data = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serializedSvg);
        }
      }

      // Trigger file download if needed
      if (download) {
        // this.triggerDownload(data, `snapshot_${progress}.svg`);
        this.triggerDownload(data, `snapshot.svg`);
      }
    } else if (this.props.renderer === 'canvas') {
      if (lottieElement) {
        const canvas = lottieElement.querySelector('canvas');
        if (canvas) {
          data = canvas.toDataURL('image/png');
        }
      }
      // Trigger file download if needed
      if (download) {
        // this.triggerDownload(data, `snapshot_${progress}.png`);
        this.triggerDownload(data, `snapshot.png`);
      }
    }

    return data;
  };

  private getSrcKey(): string {
    const { src } = this.props;
    if (typeof src === 'string') {
      return src;
    }
    try {
      return JSON.stringify(src).substring(0, 100);
    } catch {
      return 'default';
    }
  }

  private loadBookmarksFromStorage(): Bookmark[] {
    try {
      const key = `lottie-bookmarks-${this.getSrcKey()}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore storage errors
    }
    return [];
  }

  private saveBookmarksToStorage(bookmarks: Bookmark[]): void {
    try {
      const key = `lottie-bookmarks-${this.getSrcKey()}`;
      localStorage.setItem(key, JSON.stringify(bookmarks));
    } catch {
      // Ignore storage errors
    }
  }

  private loadControlsPositionFromStorage(): ControlsPosition {
    try {
      const key = `lottie-controls-position-${this.getSrcKey()}`;
      const stored = localStorage.getItem(key);
      if (stored && ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(stored)) {
        return stored as ControlsPosition;
      }
    } catch {
      // Ignore storage errors
    }
    return 'bottom-right';
  }

  private saveControlsPositionToStorage(position: ControlsPosition): void {
    try {
      const key = `lottie-controls-position-${this.getSrcKey()}`;
      localStorage.setItem(key, position);
    } catch {
      // Ignore storage errors
    }
  }

  private mergeBookmarks(animationData: any): Bookmark[] {
    const jsonBookmarks: Bookmark[] = (animationData && animationData.__bookmarks) || [];
    const localBookmarks = this.loadBookmarksFromStorage();

    const mergedMap = new Map<string, Bookmark>();

    jsonBookmarks.forEach(b => {
      mergedMap.set(b.id, b);
    });

    localBookmarks.forEach(b => {
      mergedMap.set(b.id, b);
    });

    const merged = Array.from(mergedMap.values());
    merged.sort((a, b) => {
      if (a.name === b.name) {
        return a.createdAt - b.createdAt;
      }
      return a.name.localeCompare(b.name);
    });

    return merged;
  }

  addBookmark = (name: string, note?: string): Bookmark => {
    const { instance } = this.state;
    const frame = instance ? Math.floor(instance.currentFrame) : 0;
    const bookmark: Bookmark = {
      id: `bookmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      note,
      frame,
      createdAt: Date.now(),
    };

    const newBookmarks = [...this.state.bookmarks, bookmark].sort((a, b) => {
      if (a.name === b.name) {
        return a.createdAt - b.createdAt;
      }
      return a.name.localeCompare(b.name);
    });

    this.setState({ bookmarks: newBookmarks });
    this.saveBookmarksToStorage(newBookmarks);

    if (this.state.animationData) {
      this.state.animationData.__bookmarks = newBookmarks;
    }

    if (typeof this.props.onBookmarkAdd === 'function') {
      this.props.onBookmarkAdd(bookmark);
    }
    if (typeof this.props.onBookmarksChange === 'function') {
      this.props.onBookmarksChange(newBookmarks);
    }

    return bookmark;
  };

  deleteBookmark = (bookmarkId: string): void => {
    const newBookmarks = this.state.bookmarks.filter(b => b.id !== bookmarkId);
    this.setState({ bookmarks: newBookmarks });
    this.saveBookmarksToStorage(newBookmarks);

    if (this.state.animationData) {
      this.state.animationData.__bookmarks = newBookmarks;
    }

    if (typeof this.props.onBookmarkDelete === 'function') {
      this.props.onBookmarkDelete(bookmarkId);
    }
    if (typeof this.props.onBookmarksChange === 'function') {
      this.props.onBookmarksChange(newBookmarks);
    }
  };

  seekToBookmark = (bookmarkId: string): void => {
    const bookmark = this.state.bookmarks.find(b => b.id === bookmarkId);
    if (bookmark && this.state.instance) {
      this.setSeeker(bookmark.frame, this.state.playerState === PlayerState.Playing);
    }
  };

  setControlsPosition = (position: ControlsPosition): void => {
    this.setState({ controlsPosition: position });
    this.saveControlsPositionToStorage(position);
  };

  getAnimationName = (): string => {
    const { src } = this.props;
    if (typeof src === 'string') {
      const parts = src.split('/');
      const filename = parts[parts.length - 1];
      return filename.replace(/\.[^/.]+$/, '') || 'animation';
    }
    return 'animation';
  };

  exportCurrentFrameAsPNG = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!this.state.instance || !this.props.src) {
        reject(new Error('No animation source loaded'));
        return;
      }

      const id = this.props.id ? this.props.id : 'lottie';
      const lottieElement = document.getElementById(id);
      const currentFrame = this.state.instance ? Math.floor(this.state.instance.currentFrame) : 0;
      const animationName = this.getAnimationName();
      const filename = `${animationName}-frame-${currentFrame}.png`;

      try {
        if (this.props.renderer === 'svg') {
          if (lottieElement) {
            const svgElement = lottieElement.querySelector('svg');
            if (svgElement) {
              const svgData = new XMLSerializer().serializeToString(svgElement);
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const img = new Image();

              const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
              const url = URL.createObjectURL(svgBlob);

              img.onload = () => {
                canvas.width = svgElement.clientWidth || svgElement.viewBox.baseVal.width || 512;
                canvas.height = svgElement.clientHeight || svgElement.viewBox.baseVal.height || 512;
                if (ctx) {
                  ctx.drawImage(img, 0, 0);
                  try {
                    const dataUrl = canvas.toDataURL('image/png');
                    this.triggerDownload(dataUrl, filename);
                    URL.revokeObjectURL(url);
                    resolve(dataUrl);
                  } catch (e) {
                    URL.revokeObjectURL(url);
                    reject(new Error('CORS or security error: Cannot export canvas data'));
                  }
                } else {
                  URL.revokeObjectURL(url);
                  reject(new Error('Cannot get canvas context'));
                }
              };

              img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load SVG image for export'));
              };

              img.src = url;
              return;
            }
          }
          reject(new Error('SVG element not found'));
        } else {
          if (lottieElement) {
            const canvas = lottieElement.querySelector('canvas');
            if (canvas) {
              try {
                const dataUrl = canvas.toDataURL('image/png');
                this.triggerDownload(dataUrl, filename);
                resolve(dataUrl);
              } catch (e) {
                reject(new Error('CORS or security error: Cannot export canvas data'));
              }
              return;
            }
          }
          reject(new Error('Canvas element not found'));
        }
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Export failed'));
      }
    });
  };

  public render() {
    const { children, loop, style, onBackgroundChange, className } = this.props;
    const { animationData, instance, playerState, seeker, debug, background, bookmarks, controlsPosition } = this.state;

    return (
      <div className="lf-player-container" style={{ position: 'relative' }}>
        {this.state.playerState === PlayerState.Error ? (
          <div className="lf-error">
            <span aria-label="error-symbol" role="img">
              ⚠️
            </span>
          </div>
        ) : (
          <div
            id={this.props.id ? this.props.id : 'lottie'}
            ref={el => (this.container = el)}
            style={{
              background,
              margin: '0 auto',
              outline: 'none',
              overflow: 'hidden',
              ...style,
            }}
            className={className}
          ></div>
        )}
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              animationData,
              background,
              debug,
              instance,
              loop,
              pause: () => this.pause(),
              play: () => this.play(),
              playerState,
              seeker,
              setBackground: (value: string) => {
                this.setState({ background: value });

                if (typeof onBackgroundChange === 'function') {
                  onBackgroundChange(value);
                }
              },
              setSeeker: (f: number, p: boolean) => this.setSeeker(f, p),
              stop: () => this.stop(),
              toggleDebug: () => this.toggleDebug(),
              setLoop: (loop: boolean) => this.setLoop(loop),
              colorChangedEvent: (hex: string) => {
                this.handleBgChange(hex);
              },
              snapshot: () => {
                this.snapshot();
              },
              bookmarks,
              addBookmark: this.addBookmark,
              deleteBookmark: this.deleteBookmark,
              seekToBookmark: this.seekToBookmark,
              controlsPosition,
              setControlsPosition: this.setControlsPosition,
              exportCurrentFrameAsPNG: this.exportCurrentFrameAsPNG,
            });
          }
          return null;
        })}
      </div>
    );
  }

  private toggleDebug() {
    this.setState({ debug: !this.state.debug });
  }

  private async createLottie() {
    const {
      autoplay,
      direction,
      loop,
      lottieRef,
      renderer,
      speed,
      src,
      background,
      rendererSettings,
      hover,
    } = this.props;
    const { instance } = this.state;

    if (!src || !this.container) {
      return;
    }

    // Load the resource information
    try {
      // Parse the src to see if it is a URL or Lottie JSON data
      let animationData = parseSrc(src);

      if (typeof animationData === 'string') {
        const fetchResult = await fetch(animationData as string).catch(() => {
          this.setState({ playerState: PlayerState.Error });
          this.triggerEvent(PlayerEvent.Error);
          throw new Error('@LottieFiles/lottie-react: Animation data could not be fetched.');
        });

        animationData = await fetchResult.json().catch(() => {
          this.setState({ playerState: PlayerState.Error });
          this.triggerEvent(PlayerEvent.Error);
          throw new Error('@LottieFiles/lottie-react: Animation data could not be fetched.');
        });
      }

      const mergedBookmarks = this.mergeBookmarks(animationData);
      (animationData as any).__bookmarks = mergedBookmarks;

      const savedPosition = this.loadControlsPositionFromStorage();

      this.setState({ bookmarks: mergedBookmarks, controlsPosition: savedPosition });

      // Clear previous animation, if any
      if (instance) {
        instance.destroy();
      }

      // Initialize lottie player and load animation
      const newInstance = lottie.loadAnimation({
        rendererSettings: rendererSettings || defaultOptions,
        animationData,
        autoplay: autoplay || false,
        container: this.container as Element,
        loop: loop || false,
        renderer,
      });
      if (speed) {
        newInstance.setSpeed(speed);
      }
      this.setState({ animationData });

      this.setState({ instance: newInstance }, () => {
        this.triggerEvent(PlayerEvent.InstanceSaved);

        if (typeof lottieRef === 'function') {
          lottieRef(newInstance);
        }
        if (autoplay) {
          this.play();
        }
      });

      // Handle new frame event
      newInstance.addEventListener('enterFrame', () => {
        this.triggerEvent(PlayerEvent.Frame);

        this.setState({
          seeker: Math.floor((newInstance as any).currentFrame),
        });
      });

      // Handle lottie-web ready event
      newInstance.addEventListener('DOMLoaded', () => {
        this.triggerEvent(PlayerEvent.Load);
      });

      // Handle animation data load complete
      newInstance.addEventListener('data_ready', () => {
        this.triggerEvent(PlayerEvent.Ready);
      });

      // Set error state when animation load fail event triggers
      newInstance.addEventListener('data_failed', () => {
        this.setState({ playerState: PlayerState.Error });
        this.triggerEvent(PlayerEvent.Error);
      });

      // Handle new loop event
      newInstance.addEventListener('loopComplete', () => {
        this.triggerEvent(PlayerEvent.Loop);
      });

      // Set state to paused if loop is off and anim has completed
      newInstance.addEventListener('complete', () => {
        this.triggerEvent(PlayerEvent.Complete);
        this.setState({ playerState: PlayerState.Paused });

        if (!this.props.keepLastFrame || this.props.loop) {
          this.setSeeker(0);
        }
      });

      // Set handlers to auto play animation on hover if enabled
      if (this.container) {
        this.container.addEventListener('mouseenter', () => {
          if (hover && this.state.playerState !== PlayerState.Playing) {
            if (this.props.keepLastFrame) {
              this.stop();
            }
            this.play();
          }
        });
        this.container.addEventListener('mouseleave', () => {
          if (hover && this.state.playerState === PlayerState.Playing) {
            this.stop();
          }
        });
      }

      // Set initial playback speed and direction
      if (speed) {
        this.setPlayerSpeed(speed);
      }

      if (direction) {
        this.setPlayerDirection(direction);
      }

      if (background) {
        this.setState({ background });
      }
    } catch (e) {
      this.setState({ playerState: PlayerState.Error });
      this.triggerEvent(PlayerEvent.Error);
    }
  }

  public play() {
    const { instance } = this.state;

    if (instance) {
      this.triggerEvent(PlayerEvent.Play);

      instance.play();

      this.setState({ playerState: PlayerState.Playing });
    }
  }

  public pause() {
    const { instance } = this.state;

    if (instance) {
      this.triggerEvent(PlayerEvent.Pause);

      instance.pause();

      this.setState({ playerState: PlayerState.Paused });
    }
  }

  public stop() {
    const { instance } = this.state;

    if (instance) {
      this.triggerEvent(PlayerEvent.Stop);

      instance.stop();

      this.setState({ playerState: PlayerState.Stopped });
    }
  }

  public setPlayerSpeed(speed: number) {
    const { instance } = this.state;

    if (instance) {
      instance.setSpeed(speed);
    }
  }

  public setPlayerDirection(direction: PlayerDirection) {
    const { instance } = this.state;

    if (instance) {
      instance.setDirection(direction);
    }
  }

  public setSeeker(seek: number, play = false) {
    const { instance, playerState } = this.state;

    if (instance) {
      if (!play || playerState !== PlayerState.Playing) {
        instance.goToAndStop(seek, true);
        this.triggerEvent(PlayerEvent.Pause);
        this.setState({ playerState: PlayerState.Paused });
      } else {
        instance.goToAndPlay(seek, true);
      }
    }
  }

  public setLoop(loop: boolean) {
    const { instance } = this.state;

    if (instance) {
      instance.loop = loop;
      this.setState({ instance: instance });
    }
  }
  private triggerEvent(event: PlayerEvent) {
    const { onEvent } = this.props;

    if (onEvent) {
      onEvent(event);
    }
  }
}
