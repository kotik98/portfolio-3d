export type Lang = 'ru' | 'en'
export type Copy = Record<Lang, string>

export type Artwork = {
  title: Copy
  medium: Copy
  description: Copy
  alt: Copy
  year: string
  className: string
  thumbSrc?: string
  fullSrc?: string
  objectPosition?: string
}

/**
 * Temporary catalogue of the original files in public/artworks.
 * Replace title, year, medium and description here when the final metadata
 * is ready. Optimized thumbnails can later replace thumbSrc independently.
 */
const artworkFiles = [
  '029.jpg',
  '1.jpg',
  '1_1.jpg',
  '2.jpg',
  '3.jpg',
  '4.jpg',
  '5.jpg',
  '6.jpg',
  '7.jpg',
  '8.jpg',
  '9.jpg',
  '10.jpg',
  '11.jpg',
  '12.jpg',
  '13.jpg',
  '14.jpg',
  '15.jpg',
  '16.jpg',
  '17.jpg',
  '18.jpg',
  '19.jpg',
  '20.jpg',
  '21.jpg',
  '22.jpg',
  '23.jpg',
  '24.jpg',
  '25.jpg',
  '26.jpg',
  '27.jpg',
  '28.jpg',
  '29.jpg',
  '30.jpg',
  '31.jpg',
  'Capture One Catalog0661.jpg',
  'Capture One Catalog0669.jpg',
  'Capture One Catalog0686.jpg',
  'Capture One Catalog0695.jpg',
  'DL1A0105.jpg',
  'DL1A0105_1.jpg',
  'DL1A0364.jpg',
  'DL1A0947.jpg',
  'DSC_7467.jpg',
  'DSC_7569_1.jpg',
  'DSC_7584_1.jpg',
  'DSC_7589_1.jpg',
  'DSC_7725.jpg',
  'DSC_7737.jpg',
  'DSC_7764.jpg',
  'IMG20230212154449.jpg1.jpg',
  'IMG20231217124413.jpg',
  'IMG_0626.jpg',
  'IMG_20220624_205440_BURST13.jpg',
  'IMG_20220824_152751.jpg',
  'IMG_20250210_165425_157.jpg',
  'IMG_4484.JPG',
  'IMG_9639.jpg',
  'IMG_9649.jpg',
  'IMG_9667.jpg',
  'IMG_9864.jpg',
  'IMG_9875.jpg',
  'IMG_9882.jpg',
  'IMG_9909.jpg',
  'IMG_9918.jpg',
  'P1012146.jpg',
  'P3222101.jpg',
  'P5300006 1.jpg',
  'P5300043.jpg',
  'P5300104.jpg',
  'P5300255.jpg',
  'P6083513.JPG',
  'PA044349.jpg',
  'PC183103.jpg',
  'PC183110-восстановлено.jpg',
  'PC183153.jpg',
  'PC183276.jpg',
  'Photo (49).jpg',
  'otfotkano059.jpg',
  'На просвет 2022 45×55 ткань нитки.jpg',
  'На просвет 2022 50×70 ткань нитки.jpg',
  'ПасхинА_Из серии _Прятки_(I)1.jpg',
  'ПасхинА_Из серии _Прятки_(II).jpg',
  'ПасхинА_Из серии «Прятки« (III).jpg',
  'ПасхинаА_Из серии «Прятки»_IV 2.jpg',
  'горизонт 10 37х54 лен, шерсть, шелкография, вышивка 2024.jpg',
  'горизонт 5 170х60 лен, шерсть, шелкография, вышивка 2024.jpg',
  'горизонт 6 110х31 лен, смешанная техника 2024.jpg',
  'горизонт 9 47х59 лен, шерсть, шелкография, вышивка 2024.jpg',
  'общий вид2.jpg',
] as const

const previewClasses = ['water', 'horizon', 'air', 'garden', 'shore', 'rain'] as const

export const artworks: Artwork[] = artworkFiles.map((fileName, index) => {
  const number = index < 9 ? `0${index + 1}` : String(index + 1)
  const source = `/artworks/${encodeURI(fileName)}`
  const thumbnailFileName = fileName.replace(/\.[^.]+$/, '.webp')
  const thumbnailSource = `/artworks/thumbs/${encodeURI(thumbnailFileName)}`

  return {
    title: { ru: `Работа ${number}`, en: `Artwork ${number}` },
    medium: { ru: 'оригинал', en: 'original image' },
    description: { ru: '', en: '' },
    alt: { ru: `Изображение работы ${number}`, en: `Artwork ${number}` },
    year: '—',
    className: previewClasses[index % previewClasses.length],
    thumbSrc: thumbnailSource,
    fullSrc: source,
  }
})
