# About Page Images

Place your images in this folder to use them on the About page.

## How to add images:

1. Add your image files to this folder (supports .jpg, .png, .webp, .svg)
2. Reference them in the About page using: `/about-images/your-image-name.jpg`

## Example usage in the About page:

```jsx
import Image from 'next/image';

// In your component
<Image 
  src="/about-images/team-photo.jpg" 
  alt="Our Team" 
  width={600} 
  height={400} 
  className="rounded-lg"
/>
```

## Recommended image types:

- **Hero/Banner images**: 1920x1080px or 1600x900px
- **Feature images**: 800x600px
- **Icons/Logos**: SVG format or 512x512px PNG
- **Team photos**: 400x400px (square)

## File naming conventions:

- Use lowercase letters
- Replace spaces with hyphens (-)
- Examples: `hero-banner.jpg`, `team-photo.png`, `feature-1.webp`
