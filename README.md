# Panorama Tools For Stable Diffusion Web UI

An extension for AUTOMATIC1111's [Stable Diffusion Web UI](https://github.com/AUTOMATIC1111/stable-diffusion-webui) which provides a number of tools for editing equirectangular panoramas.

![UI Screenshot](images/panorama_tools_ui_screenshot.png)

## Examples
Some examples made using this extension, all were outpainted starting from a normal image. 

Only inpainting models were used, no LoRAs or panorama-specific prompts.

[<img src="images/example_1.jpg" width="250"/>](images/example_1.jpg)
[<img src="images/example_2.jpg" width="250"/>](images/example_2.jpg)
[<img src="images/example_3.jpg" width="250"/>](images/example_3.jpg)
[<img src="images/example_4.jpg" width="250"/>](images/example_4.jpg)

## Controls

### Input
 * **Image** - Equirectangular panorama image to be edited.
 * **From Txt2Img / Img2Img / Extras** - Copy the selected image from the respective tab.
 * **From Output** - Copy the edited panorama back to the input.
 * ↩️ Revert to previous image.


### Preview
 * 3D Preview camera parameters
 * **Pitch / Yaw** - Camera angles in degrees, can be adjusted with sliders or by dragging preview.
 * **Field of View** - Camera field of view in degrees, can be adjusted by sliders or by scroll wheel.
 * **Front / Back / Left / Right / Up / Down** - Sets camera to predefined view angles.

### Inpainting
 * Projects an image onto the panorama based on the camera settings given.
 * **Enable** - Display the inpainting image on the output preview.
 * **Image** - Image to be inpainted into the panorama.
 * **From Txt2Img / Img2Img / Extras** - Copy the selected image from the respective tab.
 * ↩️ Revert to previous image.
 * **Pitch / Yaw** - Camera angles of the inpaint image.
 * **Field of View** - Camera field of the inpaint image.
 * 🖼️ - Copy last saved camera settings from 3D preview. (saves upon clicking Send To X)
 * 👁️ - Copy current camera settings from 3D preview.
 * **Mask Blur** - Blur the edges of the inpaint blending mask.

### Adjustments
 * **Reorient Pitch / Yaw** - Adjust the default pitch / yaw of the panorama.
 * **Upper/Lower Pole Offset** - Shift the location of the upper/lower poles, for fixing up images with missing poles.

### Resolution
 * **Preview Width / Height** - Render resolution of the 3D preview and images sent to other tabs.
 * **Panorama Width / Height** - Render resolution of the 2D preview and images sent to other tabs.
 * **Copy Input Resolution** - Copy the resolution of the input panorama & calculate preview resolution.

## Outputs

### 3D Preview
* **Navigation** - Click & drag to look around, mouse wheel to zoom.
* **Send To Img2Img / Inpaint / Extras** - Send the current 3D preview to the respective tab & save the camera settings.

### 2D Preview
* **Send To Img2Img / Inpaint / Extras** - Send the current 2D preview to the respective tab.
* 💾 - Download the current panorama image.