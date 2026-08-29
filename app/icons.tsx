import type { SVGProps } from 'react';

export type IconName =
  | 'alphabet' | 'animals' | 'back' | 'bedtime' | 'chevronDown' | 'chevronUp'
  | 'colors' | 'favorites' | 'food' | 'friends' | 'fullscreen' | 'fullscreenExit' | 'grid' | 'holidays' | 'lyrics'
  | 'frameSwitch' | 'movement' | 'music' | 'nature' | 'next' | 'numbers' | 'order' | 'pause'
  | 'play' | 'previous' | 'repeatAll' | 'repeatOne' | 'repeatShuffle' | 'routines'
  | 'quality' | 'search' | 'seekBack10' | 'seekForward10' | 'shuffle' | 'star' | 'subtitles' | 'vehicles'
  | 'video' | 'volume' | 'volumeMute';

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

export function Icon({ name, size = 24, className = '', ...props }: IconProps) {
  return (
    <svg className={`ui-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {iconBody(name)}
    </svg>
  );
}

function iconBody(name: IconName) {
  switch (name) {
    case 'star': return <path fill="currentColor" stroke="none" d="m12 2.4 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9l6.3-.9L12 2.4Z" />;
    case 'search': return <><circle cx="10.5" cy="10.5" r="5.8" /><path d="m15 15 4.3 4.3" /></>;
    case 'favorites': return <path d="M12 20.2 4.7 13a4.7 4.7 0 0 1 6.6-6.7l.7.8.7-.8a4.7 4.7 0 0 1 6.6 6.7L12 20.2Z" />;
    case 'grid': return <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>;
    case 'animals': return <><circle cx="7" cy="8" r="2" /><circle cx="12" cy="5.8" r="2" /><circle cx="17" cy="8" r="2" /><path d="M6.2 16.4c0-3.1 2.6-5.6 5.8-5.6s5.8 2.5 5.8 5.6c0 2-1.5 3.4-3.5 2.7L12 18.2l-2.3.9c-2 .7-3.5-.7-3.5-2.7Z" /></>;
    case 'numbers': return <><path d="M5.5 8.2 8 6v12M12 9.2c.3-2 4.5-2.3 4.8.2.3 2.3-4.8 5-4.8 8.6h5" /></>;
    case 'colors': return <><path d="M12 3.5a8.5 8.5 0 1 0 0 17h1.4a1.9 1.9 0 0 0 1.2-3.4c-.7-.5-.3-1.6.6-1.6H17a3.5 3.5 0 0 0 3.5-3.5A8.5 8.5 0 0 0 12 3.5Z" /><circle cx="7.8" cy="11" r=".8" fill="currentColor" stroke="none" /><circle cx="10" cy="7.6" r=".8" fill="currentColor" stroke="none" /><circle cx="14" cy="7.7" r=".8" fill="currentColor" stroke="none" /></>;
    case 'holidays': return <><path d="M5 10.5h14V20H5zM12 10.5V20M4 7.3h16v3.2H4z" /><path d="M12 7.3c-2.3 0-5.4-1-5.4-3 0-1.5 1.8-1.8 2.8-1 1.1.8 2.6 4 2.6 4Zm0 0c2.3 0 5.4-1 5.4-3 0-1.5-1.8-1.8-2.8-1-1.1.8-2.6 4-2.6 4Z" /></>;
    case 'vehicles': return <><path d="M4 8.5h13.5l2.5 4V17H4V8.5Z" /><path d="M7 8.5 9 5h6l2.5 3.5" /><circle cx="7.5" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /><path d="M9.2 8.5h5.8" /></>;
    case 'bedtime': return <path d="M19.5 15.4A8.2 8.2 0 0 1 8.6 4.5 8.3 8.3 0 1 0 19.5 15.4Z" />;
    case 'alphabet': return <><path d="m4 18 4.2-12 4.2 12M5.6 13.2h5.2" /><path d="M15 6h2.2a3 3 0 0 1 0 6H15V6Zm0 6h2.7a3 3 0 0 1 0 6H15v-6Z" /></>;
    case 'movement': return <><circle cx="12" cy="4.5" r="2" /><path d="m12 7 2 5 4-2M12 8.5l-4 3-3-2M14 12l2 7M11 12l-3 7" /></>;
    case 'routines': return <><path d="M7 14.5 16.5 5l2.5 2.5-9.5 9.5" /><path d="m5 16.5 2.5 2.5M14.5 7l2.5 2.5" /><circle cx="6" cy="7" r="2" /><circle cx="10" cy="4" r="1" /></>;
    case 'food': return <><path d="M12 8c-4.6-3.1-8-.3-7.1 4.3C6 18 9.1 20.5 12 19c2.9 1.5 6-1 7.1-6.7C20 7.7 16.6 4.9 12 8Z" /><path d="M12 8c0-2.7 1.1-4.4 3.7-5M12.8 5.7c-2.1.1-3.3-.7-3.9-2.2" /></>;
    case 'nature': return <><circle cx="16.8" cy="7" r="3" /><path d="M16.8 2.5V1M21 7h1.5M19.8 4l1-1M5 17.5h12a3 3 0 0 0 .2-6 5.2 5.2 0 0 0-9.8 1.4A2.4 2.4 0 0 0 5 17.5Z" /></>;
    case 'friends': return <><circle cx="8" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.4" /><path d="M3.5 19c.3-4 2-6 4.5-6s4.2 2 4.5 6M13.5 14c2.9-1.5 6.4.2 6.8 4.5" /></>;
    case 'music': return <><path d="M9 18V6l10-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>;
    case 'video': return <><rect x="3" y="5" width="18" height="14" rx="3" /><path fill="currentColor" stroke="none" d="m10 9 6 3-6 3V9Z" /></>;
    case 'lyrics': return <><path d="M5 6h9M5 10h9M5 14h6" /><path d="M17 8v8.5" /><circle cx="14.5" cy="17" r="2.5" /></>;
    case 'frameSwitch': return <><rect x="4.5" y="4.5" width="15" height="15" rx="2.8" /><path d="M8 4.5V2.8h12.2a1 1 0 0 1 1 1V16h-1.7M7.5 15l3.2-3.4 2.7 2.6 2.3-2.3 3.8 3.8" /><circle cx="9" cy="9" r="1.3" /></>;
    case 'play': return <path fill="currentColor" stroke="none" d="m8 5 11 7-11 7V5Z" />;
    case 'pause': return <><rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" /></>;
    case 'previous': return <><path d="M6 5v14" /><path fill="currentColor" stroke="none" d="m18 5-9 7 9 7V5Z" /></>;
    case 'next': return <><path d="M18 5v14" /><path fill="currentColor" stroke="none" d="m6 5 9 7-9 7V5Z" /></>;
    case 'seekBack10': return <><path d="M7 7H3V3M3.8 7a8.5 8.5 0 1 1-.3 9" /><text x="12" y="15.4" textAnchor="middle" fill="currentColor" stroke="none" fontSize="7.2" fontWeight="900">10</text></>;
    case 'seekForward10': return <><path d="M17 7h4V3M20.2 7a8.5 8.5 0 1 0 .3 9" /><text x="12" y="15.4" textAnchor="middle" fill="currentColor" stroke="none" fontSize="7.2" fontWeight="900">10</text></>;
    case 'order': return <><path d="M5 6h10M5 12h10M5 18h10M18 4v16m0 0-3-3m3 3 3-3" /></>;
    case 'shuffle': return <><path d="M4 7h3c4 0 6 10 10 10h3M17 14l3 3-3 3M4 17h3c1.7 0 3-1.8 4.2-3.9M14.2 8.5c1-1 1.9-1.5 2.8-1.5h3M17 4l3 3-3 3" /></>;
    case 'repeatShuffle': return <><path d="M7 5h9a4 4 0 0 1 4 4M17 2l3 3-3 3M17 19H8a4 4 0 0 1-4-4M7 22l-3-3 3-3" /><path d="m9 9 6 6M15 9l-6 6" /></>;
    case 'repeatAll': return <><path d="M7 5h9a4 4 0 0 1 4 4M17 2l3 3-3 3M17 19H8a4 4 0 0 1-4-4M7 22l-3-3 3-3" /></>;
    case 'repeatOne': return <><path d="M7 5h9a4 4 0 0 1 4 4M17 2l3 3-3 3M17 19H8a4 4 0 0 1-4-4M7 22l-3-3 3-3" /><text x="12" y="15" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="900">1</text></>;
    case 'volume': return <><path d="M5 10h3l4-4v12l-4-4H5v-4Z" /><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" /></>;
    case 'volumeMute': return <><path d="M5 10h3l4-4v12l-4-4H5v-4Z" /><path d="m16 10 5 5M21 10l-5 5" /></>;
    case 'quality': return <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 10h3v4H7zM14 9v6M14 12h3" /></>;
    case 'subtitles': return <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 11h4M7 15h6M15 11h2M15 15h2" /></>;
    case 'fullscreen': return <><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" /></>;
    case 'fullscreenExit': return <><path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" /></>;
    case 'back': return <><path d="m9 6-6 6 6 6M4 12h16" /></>;
    case 'chevronUp': return <path d="m7 14 5-5 5 5" />;
    case 'chevronDown': return <path d="m7 10 5 5 5-5" />;
  }
}
