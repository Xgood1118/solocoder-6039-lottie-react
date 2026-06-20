/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import './Styles.css';

import * as React from 'react';

import { ColorPicker } from './ColorPicker';
import { Bookmark, ControlsPosition, PlayerEvent, PlayerState } from './Player';
import { Popover } from './Popover';
import { Seeker } from './Seeker';

const ControlButtonStyle = {
  display: 'inline-flex',
  cursor: 'pointer',
};

interface IControlProps {
  instance?: any;
  loop?: boolean;
  pause?: () => void;
  play?: () => void;
  playerState?: PlayerState;
  seeker?: number;
  setLoop?: (value: boolean) => void;
  setSeeker?: (seek: number, play: boolean) => void;
  stop?: () => void;
  visible?: boolean;
  buttons?: string[];
  debug?: boolean;
  toggleDebug?: () => void;
  showLabels?: boolean;
  darkTheme?: boolean;
  transparentTheme?: boolean;
  colorChangedEvent?: () => void;
  snapshot?: () => void;
  bookmarks?: Bookmark[];
  addBookmark?: (name: string, note?: string) => Bookmark;
  deleteBookmark?: (id: string) => void;
  seekToBookmark?: (id: string) => void;
  controlsPosition?: ControlsPosition;
  setControlsPosition?: (position: ControlsPosition) => void;
  exportCurrentFrameAsPNG?: () => Promise<string>;
}

interface IControlsState {
  mouseDown: boolean;
  activeFrame: number;
  showAddBookmark: boolean;
  newBookmarkName: string;
  newBookmarkNote: string;
  isDragging: boolean;
  dragLeft: number;
  dragTop: number;
  exportError: string | null;
  exportLoading: boolean;
}

export class Controls extends React.Component<IControlProps, IControlsState> {
  private controlsRef: React.RefObject<HTMLDivElement>;
  private containerRef: React.RefObject<HTMLDivElement>;
  private dragMouseOffset: { x: number; y: number };
  private containerStartRect: DOMRect | null;
  private dragStartLeft: number;
  private dragStartTop: number;

  public constructor(props: IControlProps) {
    super(props);

    this.controlsRef = React.createRef();
    this.containerRef = React.createRef();
    this.dragMouseOffset = { x: 0, y: 0 };
    this.containerStartRect = null;
    this.dragStartLeft = 0;
    this.dragStartTop = 0;

    this.state = {
      activeFrame: 0,
      mouseDown: false,
      showAddBookmark: false,
      newBookmarkName: '',
      newBookmarkNote: '',
      isDragging: false,
      dragLeft: 0,
      dragTop: 0,
      exportError: null,
      exportLoading: false,
    };
  }

  public componentWillUnmount() {
    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);
  }

  private getParentContainerRect(): DOMRect | null {
    if (this.containerRef.current && this.containerRef.current.parentElement) {
      return this.containerRef.current.parentElement.getBoundingClientRect();
    }
    return null;
  }

  private getPositionStyle(): React.CSSProperties {
    const { controlsPosition } = this.props;
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      zIndex: 10,
      transition: this.state.isDragging ? 'none' : 'all 0.2s ease-out',
    };

    if (this.state.isDragging) {
      return {
        ...baseStyle,
        left: this.state.dragLeft,
        top: this.state.dragTop,
        right: 'auto',
        bottom: 'auto',
        cursor: 'grabbing',
        userSelect: 'none',
      };
    }

    switch (controlsPosition) {
      case 'top-left':
        return { ...baseStyle, top: '10px', left: '10px' };
      case 'top-right':
        return { ...baseStyle, top: '10px', right: '10px' };
      case 'bottom-left':
        return { ...baseStyle, bottom: '10px', left: '10px' };
      case 'bottom-right':
      default:
        return { ...baseStyle, bottom: '10px', right: '10px' };
    }
  }

  private handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!this.controlsRef.current) return;

    const controlsRect = this.controlsRef.current.getBoundingClientRect();
    const parentRect = this.getParentContainerRect();

    if (!parentRect) return;

    this.dragMouseOffset = {
      x: e.clientX - controlsRect.left,
      y: e.clientY - controlsRect.top,
    };

    this.dragStartLeft = controlsRect.left - parentRect.left;
    this.dragStartTop = controlsRect.top - parentRect.top;
    this.containerStartRect = parentRect;

    this.setState({
      isDragging: true,
      dragLeft: this.dragStartLeft,
      dragTop: this.dragStartTop,
    });

    document.addEventListener('mousemove', this.handleDragMove);
    document.addEventListener('mouseup', this.handleDragEnd);
  };

  private handleDragMove = (e: MouseEvent) => {
    if (!this.state.isDragging || !this.containerStartRect) return;

    const newLeft = e.clientX - this.containerStartRect.left - this.dragMouseOffset.x;
    const newTop = e.clientY - this.containerStartRect.top - this.dragMouseOffset.y;

    this.setState({
      dragLeft: newLeft,
      dragTop: newTop,
    });
  };

  private handleDragEnd = (_e: MouseEvent) => {
    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);

    if (!this.state.isDragging || !this.controlsRef.current) {
      this.setState({ isDragging: false });
      return;
    }

    const parentRect = this.getParentContainerRect();
    const controlsRect = this.controlsRef.current.getBoundingClientRect();

    if (!parentRect) {
      this.setState({ isDragging: false });
      return;
    }

    const finalCenterX = controlsRect.left + controlsRect.width / 2 - parentRect.left;
    const finalCenterY = controlsRect.top + controlsRect.height / 2 - parentRect.top;

    const containerCenterX = parentRect.width / 2;
    const containerCenterY = parentRect.height / 2;

    let newPosition: ControlsPosition;

    if (finalCenterX < containerCenterX && finalCenterY < containerCenterY) {
      newPosition = 'top-left';
    } else if (finalCenterX >= containerCenterX && finalCenterY < containerCenterY) {
      newPosition = 'top-right';
    } else if (finalCenterX < containerCenterX && finalCenterY >= containerCenterY) {
      newPosition = 'bottom-left';
    } else {
      newPosition = 'bottom-right';
    }

    if (this.props.setControlsPosition) {
      this.props.setControlsPosition(newPosition);
    }

    this.containerStartRect = null;
    this.setState({ isDragging: false, dragLeft: 0, dragTop: 0 });
  };

  private handleAddBookmark = () => {
    const { newBookmarkName, newBookmarkNote } = this.state;
    if (!newBookmarkName.trim()) return;

    if (this.props.addBookmark) {
      this.props.addBookmark(newBookmarkName.trim(), newBookmarkNote.trim() || undefined);
    }

    this.setState({
      showAddBookmark: false,
      newBookmarkName: '',
      newBookmarkNote: '',
    });
  };

  private handleExportFrame = async () => {
    if (!this.props.exportCurrentFrameAsPNG) return;

    this.setState({ exportLoading: true, exportError: null });

    try {
      await this.props.exportCurrentFrameAsPNG();
      this.setState({ exportLoading: false });
    } catch (e) {
      this.setState({
        exportLoading: false,
        exportError: e instanceof Error ? e.message : 'Export failed',
      });
    }
  };

  private handleButtonClick = (handler: () => void) => {
    if (this.state.isDragging) return;
    handler();
  };

  public render() {
    const {
      instance,
      playerState,
      seeker,
      setLoop,
      setSeeker,
      play,
      pause,
      stop,
      visible,
      buttons,
      bookmarks = [],
      deleteBookmark,
      seekToBookmark,
    } = this.props;

    if (!instance) {
      return null;
    }

    if (!visible) {
      return null;
    }

    const showPlayButton = !buttons || buttons.includes('play');
    const showStopButton = !buttons || buttons.includes('stop');
    const showRepeatButton = !buttons || buttons.includes('repeat');
    const showFrameInput = !buttons || buttons.includes('frame');
    const showBackgroundChange = !buttons || buttons.includes('background');
    const showSnapshot = !buttons || buttons.includes('snapshot');
    const showBookmarks = !buttons || buttons.includes('bookmarks');
    const ICON_SIZE = { width: 14, height: 14, viewBox: '0 0 24 24' };
    const currentFrame = Math.round(instance.currentFrame);
    const hasBookmarks = bookmarks.length > 0;

    return (
      <div ref={this.containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
        {hasBookmarks && (
          <div className="lf-bookmarks-panel">
            <div className="lf-bookmarks-header">
              <span>Bookmarks ({bookmarks.length})</span>
            </div>
            <div className="lf-bookmarks-list">
              {bookmarks.map(bookmark => (
                <div
                  key={bookmark.id}
                  className={`lf-bookmark-item ${currentFrame === bookmark.frame ? 'active' : ''}`}
                  onClick={() => this.handleButtonClick(() => seekToBookmark && seekToBookmark(bookmark.id))}
                >
                  <div className="lf-bookmark-info">
                    <span className="lf-bookmark-name">{bookmark.name}</span>
                    <span className="lf-bookmark-frame">Frame {bookmark.frame}</span>
                    {bookmark.note && <span className="lf-bookmark-note">{bookmark.note}</span>}
                  </div>
                  <button
                    className="lf-bookmark-delete"
                    onClick={e => {
                      e.stopPropagation();
                      this.handleButtonClick(() => deleteBookmark && deleteBookmark(bookmark.id));
                    }}
                    disabled={this.state.isDragging}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          ref={this.controlsRef}
          className="lf-player-controls lf-floating-controls"
          style={{
            ...this.getPositionStyle(),
            display: 'flex',
            justifyContent: 'space-between',
            height: '60px',
            alignItems: 'center',
            backgroundColor: this.props.transparentTheme
              ? 'rgba(0,0,0,0.5)'
              : this.props.darkTheme
              ? '#3C3C3C'
              : '#ffffff',
            paddingLeft: '10px',
            paddingRight: '10px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            pointerEvents: this.state.isDragging ? 'none' : 'auto',
          }}
        >
          <div
            className="lf-controls-drag-handle"
            onMouseDown={this.handleDragStart}
            style={{
              cursor: this.state.isDragging ? 'grabbing' : 'grab',
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              color: this.props.darkTheme ? '#B9B9B9' : '#999',
              fontSize: '18px',
              userSelect: 'none',
            }}
            title="Drag to move"
          >
            ⋮⋮
          </div>

          {showPlayButton && (
            <div
              role="button"
              aria-label={playerState === PlayerState.Playing ? PlayerEvent.Pause : PlayerEvent.Play}
              tabIndex={0}
              onClick={() =>
                this.handleButtonClick(() => {
                  if (playerState === PlayerState.Playing) {
                    if (typeof pause === 'function') {
                      pause();
                    }
                  } else {
                    if (typeof play === 'function') {
                      play();
                    }
                  }
                })
              }
              onKeyDown={() => {
                if (this.state.isDragging) return;
                if (playerState === PlayerState.Playing) {
                  if (typeof pause === 'function') {
                    pause();
                  }
                } else {
                  if (typeof play === 'function') {
                    play();
                  }
                }
              }}
              className="lf-player-btn"
              style={ControlButtonStyle}
            >
              {playerState === PlayerState.Playing ? (
                <svg {...ICON_SIZE}>
                  <rect height="22.9" rx="1.9" width="7.6" x="14" y=".5"></rect>
                  <rect height="22.9" rx="1.9" width="7.6" x="2" y=".5"></rect>
                </svg>
              ) : (
                <svg {...ICON_SIZE}>
                  <path d="M2 3.4C2 1.9 3.5 1 4.8 1.8l16.5 9.6c1.2.7 1.2 2.5 0 3.2L4.8 24.2C3.5 25 2 24.1 2 22.6V3.4z"></path>
                </svg>
              )}
            </div>
          )}
          {showStopButton && (
            <div
              tabIndex={0}
              role="button"
              aria-label={PlayerEvent.Stop}
              onClick={() => this.handleButtonClick(() => stop && stop())}
              onKeyDown={() => this.handleButtonClick(() => stop && stop())}
              className={playerState === PlayerState.Stopped ? 'lf-player-btn active' : 'lf-player-btn'}
              style={ControlButtonStyle}
            >
              <svg {...ICON_SIZE}>
                <path
                  d="M2 3.667A1.67 1.67 0 0 1 3.667 2h16.666A1.67 1.67 0 0 1 22 3.667v16.666A1.67 1.67 0 0 1 20.333
            22H3.667A1.67 1.67 0 0 1 2 20.333z"
                ></path>
              </svg>
            </div>
          )}
          <Seeker
            min={0}
            step={1}
            max={instance ? instance.totalFrames : 1}
            value={seeker || 0}
            onChange={(newFrame: any) => {
              if (setSeeker && !this.state.isDragging) {
                this.setState({ activeFrame: newFrame }, () => {
                  setSeeker(newFrame, false);
                });
              }
            }}
            onChangeEnd={(newFrame: any) => {
              if (setSeeker && !this.state.isDragging) {
                this.setState({ activeFrame: newFrame }, () => {
                  setSeeker(newFrame, false);
                });
              }
            }}
            showLabels={this.props.showLabels}
            darkTheme={this.props.darkTheme}
          />
          {showFrameInput && (
            <div role="button" className="lf-player-btn-container">
              <input
                style={{
                  outline: 'none',
                  border: this.props.darkTheme ? '1px #505050 solid' : '1px #ccc solid',
                  borderRadius: '3px',
                  width: '40px',
                  textAlign: 'center',
                  backgroundColor: this.props.darkTheme ? '#505050' : '#ffffff',
                  color: this.props.darkTheme ? '#B9B9B9' : '#999',
                  fontSize: '0.7rem',
                  padding: '0',
                  fontFamily: 'inherit',
                }}
                type="text"
                value={currentFrame}
                readOnly
              />
            </div>
          )}
          {showRepeatButton && (
            <div
              role="button"
              aria-label={PlayerEvent.Loop}
              tabIndex={0}
              onClick={() =>
                this.handleButtonClick(() => {
                  if (instance && setLoop) {
                    setLoop(!instance.loop);
                  }
                })
              }
              onKeyDown={() =>
                this.handleButtonClick(() => {
                  if (instance && setLoop) {
                    setLoop(!instance.loop);
                  }
                })
              }
              className={instance.loop ? 'lf-player-btn active' : 'lf-player-btn'}
              style={ControlButtonStyle}
            >
              <svg {...ICON_SIZE}>
                <path
                  d="M12.5 16.8137h-.13v1.8939h4.9696c3.6455 0 6.6113-2.9658 6.6113-6.6116
            0-3.64549-2.9658-6.61131-6.6113-6.61131-.5231 0-.947.42391-.947.94696 0 .52304.4239.94696.947.94696 2.6011 0
            4.7174 2.11634 4.7174 4.71739 0 2.6014-2.1166 4.7177-4.7174 4.7177H12.5zM13.6025
            5.61469v-.13H7.48137C3.83582 5.48469.87 8.45051.87 12.096c0 3.6509 3.17269 6.6117 6.81304 6.6117.52304 0
            .94696-.424.94696-.947 0-.5231-.42392-.947-.94696-.947-2.60804 0-4.91907-2.1231-4.91907-4.7176 0-2.60115
            2.11634-4.71744 4.7174-4.71744h6.12113V5.61469z"
                  stroke="#8795A1"
                  strokeWidth=".26"
                ></path>
                <path
                  d="M11.1482
            2.20355h0l-.001-.00116c-.3412-.40061-.9405-.44558-1.33668-.0996h-.00001c-.39526.34519-.43936.94795-.09898
            1.34767l2.51487 3.03683-2.51894 3.06468c-.33872.40088-.29282 1.00363.10347
            1.34723l.08517-.0982-.08517.0982c.17853.1549.39807.2308.61647.2308.2671 0 .5328-.114.72-.3347h0l.0011-.0014
            3.0435-3.68655.0006-.00068c.3035-.35872.3025-.88754-.0019-1.24526l-3.0425-3.65786zM13.9453
            21.7965h0l.001.0011c.3413.4006.9407.4456 1.337.0996h0c.3953-.3452.4395-.9479.099-1.3477l-2.5154-3.0368
            2.5195-3.0647c.3388-.4008.2929-1.0036-.1035-1.3472l-.0852.0982.0852-.0982c-.1786-.1549-.3981-.2308-.6166-.2308-.2671
            0-.5329.114-.7202.3347h0l-.0011.0014-3.0442
            3.6865c-.0001.0003-.0003.0005-.0005.0007-.3036.3587-.3027.8876.0019 1.2453l3.0431 3.6579z"
                  fill="#8795A1"
                  stroke="#8795A1"
                  strokeWidth=".26"
                ></path>
              </svg>
            </div>
          )}
          {showBookmarks && (
            <Popover
              icon={
                <svg {...ICON_SIZE}>
                  <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"></path>
                </svg>
              }
            >
              <div slot="content" className="lf-popover lf-popover-bookmarks">
                {this.state.showAddBookmark ? (
                  <div className="lf-add-bookmark-form">
                    <h5>Add Bookmark</h5>
                    <input
                      type="text"
                      placeholder="Bookmark name"
                      value={this.state.newBookmarkName}
                      onChange={e => this.setState({ newBookmarkName: e.target.value })}
                      className="lf-text-input"
                      style={{ width: '100%', marginBottom: '8px' }}
                    />
                    <input
                      type="text"
                      placeholder="Note (optional)"
                      value={this.state.newBookmarkNote}
                      onChange={e => this.setState({ newBookmarkNote: e.target.value })}
                      className="lf-text-input"
                      style={{ width: '100%', marginBottom: '8px' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => this.handleAddBookmark()}
                        disabled={!this.state.newBookmarkName.trim()}
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          backgroundColor: '#0FCCCE',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Add at Frame {currentFrame}
                      </button>
                      <button
                        onClick={() =>
                          this.setState({ showAddBookmark: false, newBookmarkName: '', newBookmarkNote: '' })
                        }
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#ccc',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{ cursor: 'pointer', color: '#0FCCCE', marginBottom: '8px' }}
                      onClick={() => this.setState({ showAddBookmark: true })}
                    >
                      + Add Bookmark at Frame {currentFrame}
                    </div>
                    {hasBookmarks && (
                      <div className="lf-bookmarks-mini-list">
                        {bookmarks.slice(0, 5).map(bookmark => (
                          <div
                            key={bookmark.id}
                            className="lf-bookmark-mini-item"
                            onClick={() => seekToBookmark && seekToBookmark(bookmark.id)}
                          >
                            <span>{bookmark.name}</span>
                            <span className="lf-bookmark-frame-mini">F{bookmark.frame}</span>
                          </div>
                        ))}
                        {bookmarks.length > 5 && (
                          <div style={{ color: '#999', fontSize: '0.7rem', marginTop: '4px' }}>
                            ...and {bookmarks.length - 5} more
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Popover>
          )}
          {showBackgroundChange && (
            <Popover
              icon={
                <svg {...ICON_SIZE}>
                  <path
                    d="M12 3.1L6.1 8.6a7.6 7.6 0 00-2.2 4 7.2 7.2 0 00.4 4.4 7.9 7.9 0 003 3.5 8.7 8.7 0 004.7 1.3c1.6 0
            3.2-.5 4.6-1.3s2.4-2 3-3.5a7.2 7.2 0 00.5-4.5 7.6 7.6 0 00-2.2-4L12 3.2zM12 0l7.5 7a9.8 9.8 0 013 5.1
            9.3 9.3 0 01-.6 5.8c-.9 1.8-2.2 3.3-4 4.4A11.2 11.2 0 0112 24a11.2 11.2 0
            01-6-1.7c-1.7-1-3-2.6-3.9-4.4a9.3 9.3 0 01-.6-5.8c.4-2 1.5-3.7 3-5L12 0zM6 14h12c0 1.5-.7 3-1.8 4s-2.6
            1.6-4.2 1.6S9 19 7.8 18s-1.7-2.5-1.7-4z"
                  ></path>
                </svg>
              }
            >
              <div slot="content" className="lf-popover popover-background">
                <ColorPicker colorChangedEvent={this.props.colorChangedEvent} />
              </div>
            </Popover>
          )}
          {showSnapshot && (
            <Popover
              icon={
                <svg {...ICON_SIZE}>
                  <path
                    clipRule="evenodd"
                    d="M0 3.01A2.983 2.983 0 012.983.027H16.99a2.983 2.983 0 012.983 2.983v14.008a2.982 2.982 0 01-2.983
              2.983H2.983A2.983 2.983 0 010 17.018zm2.983-.941a.941.941 0 00-.942.94v14.01c0
              .52.422.94.942.94H16.99a.94.94 0 00.941-.94V3.008a.941.941 0 00-.94-.94H2.981z"
                    fillRule="evenodd"
                  ></path>
                  <path d="M12.229 7.945l-2.07 4.598-2.586-2.605-2.414 2.758v2.146h9.656V11.93z"></path>
                  <circle cx="7.444" cy="6.513" r="2.032"></circle>
                  <path
                    d="M9.561 23.916h11.25a2.929 2.929 0 002.926-2.927V9.954a1.06 1.06 0 10-2.122 0v11.035a.805.805 0
              01-.803.804H9.562a1.061 1.061 0 100 2.123z"
                    stroke="#8795a1"
                    strokeWidth=".215"
                  ></path>
                </svg>
              }
            >
              <div
                slot="content"
                className="lf-popover lf-popover-snapshot"
                onWheel={e => {
                  if (setSeeker && !this.state.isDragging)
                    setSeeker(currentFrame + (e.deltaY > 0 ? -1 : 1), false);
                }}
              >
                <h5>Frame {currentFrame}</h5>
                <div
                  style={{ cursor: 'pointer', color: '#0FCCCE', marginBottom: '5px' }}
                  onClick={() => this.handleButtonClick(() => this.props.snapshot && this.props.snapshot())}
                >
                  Download SVG
                </div>
                <div
                  style={{
                    cursor: this.state.exportLoading ? 'wait' : 'pointer',
                    color: this.state.exportLoading ? '#999' : '#0FCCCE',
                    marginBottom: '5px',
                  }}
                  onClick={() => this.handleButtonClick(() => this.handleExportFrame())}
                >
                  {this.state.exportLoading ? 'Exporting...' : 'Export Frame as PNG'}
                </div>
                {this.state.exportError && (
                  <div className="lf-export-error" style={{ color: '#e74c3c', fontSize: '0.7rem', marginTop: '5px' }}>
                    Error: {this.state.exportError}
                  </div>
                )}
                <i className="lf-note">Scroll with mousewheel to find exact frame</i>
              </div>
            </Popover>
          )}
        </div>
      </div>
    );
  }
}
