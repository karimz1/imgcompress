import { test } from '@playwright/test';
import {
  assertFilesPresentInDropzoneAsync,
  uploadFilesToDropzoneAsync,
  removeImageFileFromDropzoneAsync,
} from './utls/helpers';
import { ImageFileDto } from './utls/ImageFileDto';

test('test remove single file from dropzone works', async ({ page }) => {
  await page.goto('/');

  const imageFileNames: ImageFileDto[] = [
    new ImageFileDto("pexels-pealdesign-28594392.jpg", 3486),
    new ImageFileDto("pexels-willianjusten-29944187.jpg", 3648),
  ];

  // Upload both files.
  await uploadFilesToDropzoneAsync(page, imageFileNames);
  
  // Assert that both files are present.
  await assertFilesPresentInDropzoneAsync(page, imageFileNames);

  // Remove the second file (index 1) from the dropzone.
  await removeImageFileFromDropzoneAsync(page, imageFileNames[1]);

  // Create a new array excluding the removed file.
  const alteredImageFileNamesArray = [...imageFileNames];
  alteredImageFileNamesArray.splice(1, 1); // remove the file at index 1

  // Assert that only the remaining file is present in the dropzone.
  await assertFilesPresentInDropzoneAsync(page, alteredImageFileNamesArray);
});
