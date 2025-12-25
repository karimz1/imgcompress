import { test } from '@playwright/test';
import {
  assertFilesPresentInDropzoneAsync,
  uploadFilesToDropzoneAsync,
  removeImageFileFromDropzoneAsync,
  setOutputFormatAsync,
} from './utls/helpers';
import { ImageFileDto } from './utls/ImageFileDto';

test('test remove single file from dropzone works', async ({ page }) => {
  await page.goto('/');

  const imageFileNames: ImageFileDto[] = [
    new ImageFileDto("pexels-pealdesign-28594392.jpg", 3486),
    new ImageFileDto("pexels-willianjusten-29944187.jpg", 3648),
  ];

  
  await uploadFilesToDropzoneAsync(page, imageFileNames);
  
  
  await assertFilesPresentInDropzoneAsync(page, imageFileNames);

  await setOutputFormatAsync(page, "JPEG");
  await removeImageFileFromDropzoneAsync(page, imageFileNames[1]);

  
  const alteredImageFileNamesArray = [...imageFileNames];
  alteredImageFileNamesArray.splice(1, 1); 

  
  await assertFilesPresentInDropzoneAsync(page, alteredImageFileNamesArray);
});
