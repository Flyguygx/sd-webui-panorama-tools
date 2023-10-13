import contextlib
import os
import gradio as gr
from modules import scripts
from modules import script_callbacks
from modules import shared
from modules.ui_components import ToolButton

sendto_inputs = {
    "img2img" : {"elem_id" : "img2img_image", "component" : None},
    "inpaint" : {"elem_id" : "img2maskimg", "component" : None},
    "extras" : {"elem_id" : "extras_image", "component" : None}
}

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

def copy_input_resolution(image):
    if (image.width is not None) and (image.height is not None):
        preview_width = round(image.width/4)
        preview_height = round(image.height/2)
        return preview_width, preview_height, image.width, image.height


def on_ui_tabs():
    with gr.Blocks(analytics_enabled=False) as panorama_tools_ui:
        with gr.Row():
            with gr.Column():
                with gr.Row():
                    panorama_input_image = gr.Image(
                        source="upload",
                        type="numpy",
                        elem_id=f"panorama_input_image",
                        elem_classes=["panorama-image"],
                    )
                with gr.Row(variant="compact"):
                    copyPanoramaFromTxt2Img = gr.Button(value="From Txt2Img")
                    copyPanoramaFromImg2Img = gr.Button(value="From Img2Img")
                    copyPanoramaFromExtras = gr.Button(value="From Extras")
                    copyPanoramaFromOutput = gr.Button(value="From Output")
                    previousPanoramaImage = ToolButton('↩️', tooltip=f"Revert to previous panorama image")
                with gr.Row():
                    with gr.Accordion("Preview", open=True, elem_id="panorama_tools_preview", visible=True):
                        with gr.Row(variant="compact"): 
                            previewPitch = gr.Slider(elem_id="panorama_tools_preview_pitch", label="Pitch  ", minimum=-90, maximum=90, value=0, step=1, interactive=True)
                            previewYaw = gr.Slider(elem_id="panorama_tools_preview_yaw", label="Yaw  ", minimum=-180, maximum=180, value=0, step=1, interactive=True)
                            previewZoom = gr.Slider(elem_id="panorama_tools_preview_zoom", label="Zoom  ", minimum=0, maximum=10, value=1, step=0.05, interactive=True)
                with gr.Row():
                    with gr.Accordion("Inpainting", open=True, elem_id="panorama_tools_inpaint", visible=True):
                        inpaintEnable = gr.Checkbox(label="Enable")  
                        panorama_inpaint_input_image = gr.Image(
                            source="upload",
                            type="numpy",
                            elem_id=f"panorama_inpaint_input_image",
                            elem_classes=["panorama-image"],
                        )
                        with gr.Row(variant="compact"):        
                            copyInpaintFromTxt2Img = gr.Button(value="From Txt2Img")
                            copyInpaintFromImg2Img = gr.Button(value="From Img2Img")
                            copyInpaintFromExtras = gr.Button(value="From Extras")
                            previousInpaintImage = ToolButton('↩️', tooltip=f"Revert to previous inpainting image")                           
                        with gr.Row(variant="compact"):    
                            inpaintPitch = gr.Slider(elem_id="panorama_tools_inpaint_pitch", label="Pitch   ", minimum=-90, maximum=90, value=0, step=1, interactive=True)
                            inpaintYaw = gr.Slider(elem_id="panorama_tools_inpaint_yaw", label="Yaw   ", minimum=-180, maximum=180, value=0, step=1, interactive=True)
                            inpaintZoom = gr.Slider(elem_id="panorama_tools_inpaint_zoom", label="Zoom   ", minimum=0, maximum=10, value=1, step=0.05, interactive=True)
                            copyPreviewSettings = ToolButton('👁️', tooltip=f"Copy pitch/yaw/zoom from preview.")
                        with gr.Row(variant="compact"):    
                            inpaintMaskBlur = gr.Slider(label="Mask Blur", minimum=0, maximum=10, value=1, step=0.05, interactive=True)
                            #copyPreviewSettings = ToolButton('👁️', tooltip=f"Copy pitch/yaw/zoom from preview.")#gr.Button(value="Copy Preview Settings")

                with gr.Row():
                    with gr.Accordion("Adjustments", open=True, elem_id="panorama_tools_edit", visible=True):
                        with gr.Row():
                            reorientPitch = gr.Slider(label="Reorient Pitch    ", minimum=-90, maximum=90, value=0, step=1, interactive=True)
                            reorientYaw = gr.Slider(label="Reorient Yaw   ", minimum=-180, maximum=180, value=0, step=1, interactive=True)
                        with gr.Row():
                            offsetTop = gr.Slider(label="Upper Pole Offset", minimum=0, maximum=1, value=0, step=0.01, interactive=True)
                            offsetBottom = gr.Slider(label="Lower Pole Offset", minimum=0, maximum=1, value=0, step=0.01, interactive=True)
                with gr.Row():
                    with gr.Accordion("Resolution", open=True, elem_id="panorama_tools_resolution", visible=True):
                        previewWidth = gr.Slider(label="Preview Width ", minimum=64, maximum=2048, value=512, step=64, interactive=True)
                        previewHeight = gr.Slider(label="Preview Height ", minimum=64, maximum=2048, value=512, step=64, interactive=True)
                        panoramaWidth = gr.Slider(label="Panorama Width ", minimum=64, maximum=4096, value=2048, step=64, interactive=True)
                        panoramaHeight = gr.Slider(label="Panorama Height ", minimum=64, maximum=4096, value=1024, step=64, interactive=True)
                        copyPanoramaInputRes = gr.Button(value="Copy Input Resolution")

            with gr.Column():
                with gr.Row():
                    preview_canvas = gr.HTML('<canvas id="panotools_preview_canvas" width="512" height="512" style="width: 512px; height: 512px;margin: 0.25rem; border-radius: 0.25rem; border: 0.5px solid"></canvas>')
                with gr.Row():
                    send3DImgToImg2Img = gr.Button(value="Send To Img2Img")
                    send3DImgToInpaint = gr.Button(value="Send To Inpaint")
                    send3DImgToExtras = gr.Button(value="Send To Extras")
                with gr.Row():
                    equirectangular_canvas = gr.HTML('<canvas id="panotools_equirectangular_canvas" width="2048" height="1024" style="width: 512px; height: 256px;margin: 0.25rem; border-radius: 0.25rem; border: 0.5px solid"></canvas>')
                with gr.Row():
                    send2DImgToImg2Img = gr.Button(value="Send To Img2Img")
                    send2DImgToInpaint = gr.Button(value="Send To Inpaint")
                    send2DImgToExtras = gr.Button(value="Send To Extras")
                    save2DImg = ToolButton('💾', tooltip=f"Save panorama image.")
    
        copyPreviewSettings.click(fn=None,inputs=[],outputs=[],show_progress=False,
                                  _js="() => {copyPreviewSettingsToInpaint()}")
        
        copyPanoramaInputRes.click(fn=None,inputs=[],outputs=[previewWidth, previewHeight, panoramaWidth, panoramaHeight],show_progress=False,
                                   _js="currentPanoramaInputResolution")
        
        copyPanoramaFromTxt2Img.click(fn=None,inputs=[],outputs=[panorama_input_image],show_progress=False,
                                      _js="() => {return getSelectedImageOnTab('txt2img')}")
        
        copyPanoramaFromImg2Img.click(fn=None,inputs=[],outputs=[panorama_input_image],show_progress=False,
                                      _js="() => {return getSelectedImageOnTab('img2img')}")
        
        copyPanoramaFromExtras.click(fn=None,inputs=[],outputs=[panorama_input_image],show_progress=False,
                                     _js="() => {return getSelectedImageOnTab('extras')}")
        
        copyPanoramaFromOutput.click(fn=None,inputs=[],outputs=[panorama_input_image],show_progress=False,
                                     _js="() => {return getShaderViewImage('preview_2d')}")

        copyInpaintFromTxt2Img.click(fn=None,inputs=[],outputs=[panorama_inpaint_input_image],show_progress=False,
                                     _js="() => {return getSelectedImageOnTab('txt2img')}")
        
        copyInpaintFromImg2Img.click(fn=None,inputs=[],outputs=[panorama_inpaint_input_image],show_progress=False,
                                     _js="() => {return getSelectedImageOnTab('img2img')}")
        
        copyInpaintFromExtras.click(fn=None,inputs=[],outputs=[panorama_inpaint_input_image],show_progress=False,
                                     _js="() => {return getSelectedImageOnTab('extras')}")

        send2DImgToImg2Img.click(fn=None,inputs=[],outputs=[sendto_inputs["img2img"]["component"]],show_progress=False,
                                 _js="() => {return sendShaderViewTo('preview_2d','img2img')}")
        
        send2DImgToInpaint.click(fn=None,inputs=[],outputs=[sendto_inputs["inpaint"]["component"]],show_progress=False,
                                 _js="() => {return sendShaderViewTo('preview_2d','inpaint')}")
        
        send2DImgToExtras.click(fn=None,inputs=[],outputs=[sendto_inputs["extras"]["component"]],show_progress=False,
                                _js="() => {return sendShaderViewTo('preview_2d','extras')}")

        send3DImgToImg2Img.click(fn=None,inputs=[],outputs=[sendto_inputs["img2img"]["component"]],show_progress=False,
                                 _js="() => {return sendShaderViewTo('preview_3d','img2img')}")
        
        send3DImgToInpaint.click(fn=None,inputs=[],outputs=[sendto_inputs["inpaint"]["component"]],show_progress=False,
                                 _js="() => {return sendShaderViewTo('preview_3d','inpaint')}")
        
        send3DImgToExtras.click(fn=None,inputs=[],outputs=[sendto_inputs["extras"]["component"]],show_progress=False,
                                _js="() => {return sendShaderViewTo('preview_3d','extras')}")
        
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
        panoramaWidth.change(None, [panoramaWidth, panoramaHeight], None, _js="(w,h) => {updateResolution('preview_2d', w, h, true)}")
        panoramaHeight.change(None, [panoramaWidth, panoramaHeight], None, _js="(w,h) => {updateResolution('preview_2d', w, h, true)}")

        panorama_input_image.change(None, [panorama_input_image], None, 
            _js="(url) => {loadTexture('preview_3d', 'equirectangular', url); loadTexture('preview_2d', 'equirectangular', url)}")
        
        panorama_inpaint_input_image.change(None, [panorama_inpaint_input_image], None, 
            _js="(url) => {loadTexture('preview_2d', 'inpainting', url)}")

    return [(panorama_tools_ui, "Panorama Tools", "panorama-tools")]

def after_component(component, **kwargs):
    for name, sendto_input in sendto_inputs.items():
        if kwargs.get("elem_id") == sendto_input["elem_id"]:
            sendto_input["component"] = component

script_callbacks.on_ui_tabs(on_ui_tabs)
script_callbacks.on_after_component(after_component)

baseUrl = get_extension_base_url();








