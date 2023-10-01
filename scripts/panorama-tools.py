import contextlib
import os
import gradio as gr
from modules import scripts
from modules import script_callbacks
from modules import shared

source_gallery = None

class PanoramaToolsScript(scripts.Script):
    def __init__(self) -> None:
        super().__init__()

    def title(self):
        return "Panorama Tools"

    def show(self, is_img2img):
        return scripts.AlwaysVisible

    def ui(self, is_img2img):
        return []

def get_extension_base_url():
    baseDir = scripts.basedir()
    url = baseDir[-(len(baseDir)-baseDir.find("extensions")):]
    url = url.replace(os.sep,"/")
    return "file="+url

def copy_preview_settings(preview_pitch,preview_yaw,preview_zoom,inpaint_pitch,inpaint_yaw,inpaint_zoom):
    return preview_pitch,preview_yaw, preview_zoom

def copy_img2img_to_pan_inpaint(gallery, image):
    image.value = gallery


def on_ui_tabs():
    with gr.Blocks(analytics_enabled=False) as panorama_tools_ui:
        with gr.Row():
            with gr.Column():
                panorama_input_image = gr.Image(
                    source="upload",
                    type="numpy",
                    elem_id=f"panorama_input_image",
                    elem_classes=["panorama-image"],
                )
                with gr.Row():
                    with gr.Accordion("Preview", open=True, elem_id="panorama_tools_preview", visible=True):
                        previewPitch = gr.Slider(label="Pitch ", minimum=-90, maximum=90, value=0, step=0.5, interactive=True)
                        previewYaw = gr.Slider(label="Yaw ", minimum=-180, maximum=180, value=0, step=0.5, interactive=True)
                        previewZoom = gr.Slider(label="Zoom ", minimum=0, maximum=10, value=1, step=0.025, interactive=True)
                with gr.Row():
                    with gr.Accordion("Inpainting", open=True, elem_id="panorama_tools_inpaint", visible=True):
                        panorama_inpaint_input_image = gr.Image(
                            source="upload",
                            type="numpy",
                            elem_id=f"panorama_inpaint_input_image",
                            elem_classes=["panorama-image"],
                        )
                        copyInpaintFromImg2Img = gr.Button(value="Copy From Img2Img")
                        inpaintEnable = gr.Checkbox(label="Enable")
                        inpaintPitch = gr.Slider(label="Pitch  ", minimum=-90, maximum=90, value=0, step=0.5, interactive=True)
                        inpaintYaw = gr.Slider(label="Yaw  ", minimum=-180, maximum=180, value=0, step=0.5, interactive=True)
                        inpaintZoom = gr.Slider(label="Zoom  ", minimum=0, maximum=10, value=1, step=0.025, interactive=True)
                        inpaintMaskBlur = gr.Slider(label="Mask Blur", minimum=0, maximum=10, value=1, step=0.025, interactive=True)
                        copyPreviewSettings = gr.Button(value="Copy Preview Settings")
                        patchMaskBlur = gr.Slider(label="Mask Blur", minimum=0, maximum=1, value=0, step=0.01, interactive=True)

                with gr.Row():
                    with gr.Accordion("Editing", open=True, elem_id="panorama_tools_edit", visible=True):
                        reorientPitch = gr.Slider(label="Reorient Pitch   ", minimum=-90, maximum=90, value=0, step=0.5, interactive=True)
                        reorientYaw = gr.Slider(label="Reorient Yaw   ", minimum=-180, maximum=180, value=0, step=0.5, interactive=True)
                        offsetBottom = gr.Slider(label="Lower Pole Offset", minimum=0, maximum=1, value=0, step=0.01, interactive=True)
                        offsetTop = gr.Slider(label="Upper Pole Offset", minimum=0, maximum=1, value=0, step=0.01, interactive=True)
                with gr.Row():
                    with gr.Accordion("Resolution", open=True, elem_id="panorama_tools_resolution", visible=True):
                        previewWidth = gr.Slider(label="Preview Width", minimum=64, maximum=2048, value=512, step=64, interactive=True)
                        previewHeight = gr.Slider(label="Preview Height", minimum=64, maximum=2048, value=512, step=64, interactive=True)
                        panoramaWidth = gr.Slider(label="Panorama Width", minimum=64, maximum=2048, value=1024, step=64, interactive=True)
                        panoramaHeight = gr.Slider(label="Panorama Height", minimum=64, maximum=2048, value=512, step=64, interactive=True)

            with gr.Column():
                with gr.Row():
                    preview_canvas = gr.HTML('<canvas id="panotools_preview_canvas" width="512" height="512" style="width: 512px; height: 512px;margin: 0.25rem; border-radius: 0.25rem; border: 0.5px solid"></canvas>')
                with gr.Row():
                    pano_send_preview_to_inpaint = gr.Button(value="Send Preview To Inpaint")
                with gr.Row():
                    equirectangular_canvas = gr.HTML('<canvas id="panotools_equirectangular_canvas" width="1024" height="512" style="width: 512px; height: 256px;margin: 0.25rem; border-radius: 0.25rem; border: 0.5px solid"></canvas>')
                with gr.Row():
                    pano_send_output_to_input = gr.Button(value="Send Output To Input")
    
        copyPreviewSettings.click(copy_preview_settings, inputs=[previewPitch,previewYaw,previewZoom], outputs=[inpaintPitch,inpaintYaw,inpaintZoom])
        #copyInpaintFromImg2Img.click(copy_img2img_to_pan_inpaint, inputs=[source_gallery], outputs=[panorama_inpaint_input_image])#, _js="(v) => {copyImageFrom('img2img', v)}")

        previewPitch.change(None, [previewPitch], None, _js="(v) => {setParameter('pitch', v, 'preview_3d')}")
        previewYaw.change(None, [previewYaw], None, _js="(v) => {setParameter('yaw', v, 'preview_3d')}")
        previewZoom.change(None, [previewZoom], None, _js="(v) => {setParameter('zoom', v, 'preview_3d')}")

        reorientPitch.change(None, [reorientPitch], None, _js="(v) => {setParameter('reorientPitch', v)}")
        reorientYaw.change(None, [reorientYaw], None, _js="(v) => {setParameter('reorientYaw', v)}")
        offsetBottom.change(None, [offsetBottom], None, _js="(v) => {setParameter('offsetBottom', v)}")
        offsetTop.change(None, [offsetTop], None, _js="(v) => {setParameter('offsetTop', v)}")

        inpaintEnable.change(None, [inpaintEnable], None, _js="(v) => {setParameter('maskEnable', (v ? 1.0:0.0))}")
        inpaintPitch.change(None, [inpaintPitch], None, _js="(v) => {setParameter('maskPitch', v)}")
        inpaintYaw.change(None, [inpaintYaw], None, _js="(v) => {setParameter('maskYaw', v)}")
        inpaintZoom.change(None, [inpaintZoom], None, _js="(v) => {setParameter('maskZoom', v)}")
        inpaintMaskBlur.change(None, [inpaintMaskBlur], None, _js="(v) => {setParameter('maskBlend', v)}")

        previewWidth.change(None, [previewWidth, previewHeight], None, _js="(w,h) => {updateResolution('preview_3d', w, h)}")
        previewHeight.change(None, [previewWidth, previewHeight], None, _js="(w,h) => {updateResolution('preview_3d', w, h)}")
        panoramaWidth.change(None, [panoramaWidth, panoramaHeight], None, _js="(w,h) => {updateResolution('preview_equirectangular', w, h, true)}")
        panoramaHeight.change(None, [panoramaWidth, panoramaHeight], None, _js="(w,h) => {updateResolution('preview_equirectangular', w, h, true)}")

        panorama_input_image.change(None, [panorama_input_image], None, 
            _js="(url) => {loadTexture('preview_3d', 'equirectangular', url); loadTexture('preview_equirectangular', 'equirectangular', url)}")
        
        panorama_inpaint_input_image.change(None, [panorama_inpaint_input_image], None, 
            _js="(url) => {loadTexture('preview_equirectangular', 'inpainting', url)}")

    return [(panorama_tools_ui, "Panorama Tools", "panorama-tools")]

def test(evt: gr.SelectData):
    print(evt.index)
    print(source_gallery.value)

def after_component(component, **kwargs):
    if kwargs.get("elem_id") == "img2img_gallery":
        global source_gallery
        source_gallery = component
        source_gallery.select(test,None,None)


script_callbacks.on_ui_tabs(on_ui_tabs)
script_callbacks.on_after_component(after_component)
baseUrl = get_extension_base_url();








