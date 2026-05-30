"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const BRAND_LOGO_SRC = {
  full: "/logo_transparent.png",
  face: "/logo-face.webp",
} as const;

interface BrandLogoProps {
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  alt?: string;
  priority?: boolean;
  variant?: keyof typeof BRAND_LOGO_SRC;
  style?: React.CSSProperties;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className,
  width,
  height,
  fill,
  sizes,
  alt = "",
  priority = true,
  variant = "full",
  style,
}) => {
  const decorative = !alt;
  const baseClassName = cn(
    "select-none",
    decorative && "pointer-events-none",
    className
  );
  const noDragStyle = { WebkitUserDrag: "none" } as React.CSSProperties;
  const imageStyle = { ...noDragStyle, ...style };
  const src = BRAND_LOGO_SRC[variant];

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        aria-hidden={decorative ? true : undefined}
        fill
        sizes={sizes}
        draggable={false}
        priority={priority}
        unoptimized
        className={baseClassName}
        style={imageStyle}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      aria-hidden={decorative ? true : undefined}
      width={width ?? 260}
      height={height ?? 260}
      draggable={false}
      priority={priority}
      unoptimized
      className={baseClassName}
      style={imageStyle}
    />
  );
};
