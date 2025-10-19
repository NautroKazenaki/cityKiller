// Утилиты для работы с изображениями

export function getCitizenImagePath(citizenId: number): string {
  // Попытка загрузить изображение гражданина
  try {
    return `/src/assets/citizens/citizen_${citizenId}.jpg`;
  } catch (error) {
    // Fallback на стандартную иконку
    return '/src/assets/default-citizen.png';
  }
}

export function getBuildingImagePath(buildingType: string): string {
  const buildingImages: Record<string, string> = {
    police: '/src/assets/buildings/police.png',
    hospital: '/src/assets/buildings/hospital.png',
    fire: '/src/assets/buildings/fire.png',
    diner: '/src/assets/buildings/diner.png'
  };
  
  return buildingImages[buildingType] || '/src/assets/buildings/default.png';
}

export function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function preloadImages(sources: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(sources.map(preloadImage));
}
