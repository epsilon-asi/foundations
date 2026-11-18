import type * as React from 'react';

/** Forward these anchor props when adapting a link to your application's router. */
export interface LinkRenderProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
  'data-navigation-primary'?: string;
}
export type LinkRenderer = (props: LinkRenderProps) => React.ReactNode;
