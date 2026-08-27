import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '童声星球｜少儿音视频播放器',
  description: '一个可以听儿歌、看视频、读歌词的儿童媒体乐园。',
  openGraph: {
    title: '童声星球',
    description: '可以听、可以看，也可以一起读歌词。',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: '童声星球',
    description: '可以听、可以看，也可以一起读歌词。',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
