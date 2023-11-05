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

defaultImage = "/images/default_panorama.png"

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

def on_ui_tabs():
    #UI layout
    with gr.Blocks(analytics_enabled=False) as panorama_tools_ui:
        with gr.Row():
            with gr.Column():
                with gr.Row():
                    with gr.Accordion("Input", open=True, elem_id="panorama_tools_input", visible=True):
                        panorama_input_image = gr.Image(
                            source="upload",
                            type="numpy",
                            elem_id=f"panorama_input_image",
                            elem_classes=["panorama-image"]
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
                            previewPitch = gr.Slider(elem_id="panorama_tools_preview_pitch", label="Pitch    ", minimum=-90, maximum=90, value=0, step=5, interactive=True)
                            previewYaw = gr.Slider(elem_id="panorama_tools_preview_yaw", label="Yaw    ", minimum=-180, maximum=180, value=0, step=5, interactive=True)
                            previewFov = gr.Slider(elem_id="panorama_tools_preview_fov", label="Field of View ", minimum=0, maximum=180, value=90, step=5, interactive=True)
                        with gr.Row(variant="compact"): 
                            previewFront = gr.Button(value="Front", min_width=100)
                            previewBack = gr.Button(value="Back", min_width=100)
                            previewLeft = gr.Button(value="Left", min_width=100)
                            previewRight = gr.Button(value="Right", min_width=100)
                            previewUp = gr.Button(value="Up", min_width=100)
                            previewDown = gr.Button(value="Down", min_width=100)

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
                            inpaintPitch = gr.Slider(elem_id="panorama_tools_inpaint_pitch", label="Pitch     ", minimum=-90, maximum=90, value=0, step=5, interactive=True)
                            inpaintYaw = gr.Slider(elem_id="panorama_tools_inpaint_yaw", label="Yaw     ", minimum=-180, maximum=180, value=0, step=5, interactive=True)
                            inpaintFov = gr.Slider(elem_id="panorama_tools_inpaint_fov", label="Field of View", minimum=0, maximum=180, value=90, step=5, interactive=True)
                            copyLastPreviewSettings = ToolButton('🖼️', tooltip=f"Copy pitch/yaw/fov from last preview snapshot.")
                            copyPreviewSettings = ToolButton('👁️', tooltip=f"Copy pitch/yaw/fov from current preview.")
                        with gr.Row(variant="compact"):    
                            inpaintMaskBlur = gr.Slider(label="Mask Blur    ", minimum=0, maximum=1, value=0.01, step=0.01, interactive=True)

                with gr.Row():
                    with gr.Accordion("Adjustments", open=True, elem_id="panorama_tools_edit", visible=True):
                        with gr.Row():
                            reorientPitch = gr.Slider(label="Reorient Pitch      ", minimum=-90, maximum=90, value=0, step=5, interactive=True)
                            reorientYaw = gr.Slider(label="Reorient Yaw     ", minimum=-180, maximum=180, value=0, step=5, interactive=True)
                        with gr.Row():
                            offsetTop = gr.Slider(label="Upper Pole Offset", minimum=0, maximum=1, value=0, step=0.01, interactive=True)
                            offsetBottom = gr.Slider(label="Lower Pole Offset", minimum=0, maximum=1, value=0, step=0.01, interactive=True)

                with gr.Row():
                    with gr.Accordion("Resolution", open=True, elem_id="panorama_tools_resolution", visible=True):
                        previewWidth = gr.Slider(label="Preview Width ", minimum=64, maximum=2048, value=512, step=64, interactive=True)
                        previewHeight = gr.Slider(label="Preview Height ", minimum=64, maximum=2048, value=512, step=64, interactive=True)
                        panoramaWidth = gr.Slider(label="Panorama Width ", minimum=64, maximum=4096, value=2048, step=64, interactive=True)
                        panoramaHeight = gr.Slider(label="Panorama Height ", minimum=64, maximum=4096, value=1024, step=64, interactive=True)
                        with gr.Row():
                            copyPanoramaInputRes = gr.Button(value="From Panorama Image")
                            copyInpaintInputRes = gr.Button(value="From Inpaint Image")

            with gr.Column():
                with gr.Row():
                    preview_canvas = gr.HTML('<canvas id="panotools_preview_canvas" width="512" height="512" style="width: 512px; height: 512px;margin: 0.25rem; border-radius: 0.25rem; border: 0.5px solid"></canvas>')
                with gr.Row(variant="compact"):
                    send3DImgToImg2Img = gr.Button(value="Send To Img2Img")
                    send3DImgToInpaint = gr.Button(value="Send To Inpaint")
                    send3DImgToExtras = gr.Button(value="Send To Extras")

                with gr.Row():
                    equirectangular_canvas = gr.HTML('<canvas id="panotools_equirectangular_canvas" width="2048" height="1024" style="width: 512px; height: 256px;margin: 0.25rem; border-radius: 0.25rem; border: 0.5px solid"></canvas>')
                with gr.Row(variant="compact"):
                    send2DImgToImg2Img = gr.Button(value="Send To Img2Img")
                    send2DImgToInpaint = gr.Button(value="Send To Inpaint")
                    send2DImgToExtras = gr.Button(value="Send To Extras")
                    save2DImage = ToolButton('💾', tooltip=f"Save panorama image.")

        #UI event handling
        #Button click events
        previewFront.click(fn=None,show_progress=False, _js="() => {panorama_tools.setPredefinedView('front')}")
        previewBack.click(fn=None,show_progress=False, _js="() => {panorama_tools.setPredefinedView('back')}")
        previewLeft.click(fn=None,show_progress=False, _js="() => {panorama_tools.setPredefinedView('left')}")
        previewRight.click(fn=None,show_progress=False, _js="() => {panorama_tools.setPredefinedView('right')}")
        previewUp.click(fn=None,show_progress=False, _js="() => {panorama_tools.setPredefinedView('up')}")
        previewDown.click(fn=None,show_progress=False, _js="() => {panorama_tools.setPredefinedView('down')}")

        copyLastPreviewSettings.click(fn=None,inputs=[],outputs=[],show_progress=False,
                                  _js="() => {panorama_tools.copyLastPreviewSettingsToInpaint()}")
        
        copyPreviewSettings.click(fn=None,inputs=[],outputs=[],show_progress=False,
                                  _js="() => {panorama_tools.copyPreviewSettingsToInpaint()}")
        
        copyPanoramaInputRes.click(fn=None,inputs=[],outputs=[previewWidth, previewHeight, panoramaWidth, panoramaHeight],show_progress=False,
                                   _js="() => {return panorama_tools.viewResolutionFromInput()}")
        
        copyInpaintInputRes.click(fn=None,inputs=[],outputs=[previewWidth, previewHeight, panoramaWidth, panoramaHeight],show_progress=False,
                                   _js="() => {return panorama_tools.viewResolutionFromInpaint()}")
        
        copyPanoramaFromTxt2Img.click(fn=None,inputs=[],outputs=[panorama_input_image],show_progress=False,
                                      _js="() => {return panorama_tools.getSelectedImageOnTab('txt2img')}")
        
        copyPanoramaFromImg2Img.click(fn=None,inputs=[],outputs=[panorama_input_image],show_progress=False,
                                      _js="() => {return panorama_tools.getSelectedImageOnTab('img2img')}")
        
        copyPanoramaFromExtras.click(fn=None,inputs=[],outputs=[panorama_input_image],show_progress=False,
                                     _js="() => {return panorama_tools.getSelectedImageOnTab('extras')}")
        
        copyPanoramaFromOutput.click(fn=None,inputs=[],outputs=[panorama_input_image],show_progress=False,
                                     _js="() => {return panorama_tools.getShaderViewImage('preview_2d')}")
        
        previousPanoramaImage.click(fn=None,inputs=[],outputs=[panorama_input_image],show_progress=False,
                                     _js="() => {return panorama_tools.revertPanoramaImage()}")

        copyInpaintFromTxt2Img.click(fn=None,inputs=[],outputs=[panorama_inpaint_input_image],show_progress=False,
                                     _js="() => {return panorama_tools.getSelectedImageOnTab('txt2img')}")
        
        copyInpaintFromImg2Img.click(fn=None,inputs=[],outputs=[panorama_inpaint_input_image],show_progress=False,
                                     _js="() => {return panorama_tools.getSelectedImageOnTab('img2img')}")
        
        copyInpaintFromExtras.click(fn=None,inputs=[],outputs=[panorama_inpaint_input_image],show_progress=False,
                                     _js="() => {return panorama_tools.getSelectedImageOnTab('extras')}")
        
        previousInpaintImage.click(fn=None,inputs=[],outputs=[panorama_inpaint_input_image],show_progress=False,
                                     _js="() => {return panorama_tools.revertInpaintImage()}")

        send2DImgToImg2Img.click(fn=None,inputs=[],outputs=[sendto_inputs["img2img"]["component"]],show_progress=False,
                                 _js="() => {return panorama_tools.sendShaderViewTo('preview_2d','img2img')}")
        
        send2DImgToInpaint.click(fn=None,inputs=[],outputs=[sendto_inputs["inpaint"]["component"]],show_progress=False,
                                 _js="() => {return panorama_tools.sendShaderViewTo('preview_2d','inpaint')}")
        
        send2DImgToExtras.click(fn=None,inputs=[],outputs=[sendto_inputs["extras"]["component"]],show_progress=False,
                                _js="() => {return panorama_tools.sendShaderViewTo('preview_2d','extras')}")
        
        save2DImage.click(fn=None,inputs=[],outputs=[],show_progress=False,
                                _js="() => {return panorama_tools.downloadShaderViewImage('preview_2d', 'panorama.png')}")

        send3DImgToImg2Img.click(fn=None,inputs=[],outputs=[sendto_inputs["img2img"]["component"]],show_progress=False,
                                 _js="() => {panorama_tools.savePreviewSettings(); return panorama_tools.sendShaderViewTo('preview_3d','img2img');}")
        
        send3DImgToInpaint.click(fn=None,inputs=[],outputs=[sendto_inputs["inpaint"]["component"]],show_progress=False,
                                 _js="() => {panorama_tools.savePreviewSettings(); return panorama_tools.sendShaderViewTo('preview_3d','inpaint');}")

        send3DImgToExtras.click(fn=None,inputs=[],outputs=[sendto_inputs["extras"]["component"]],show_progress=False,
                                _js="() => {panorama_tools.savePreviewSettings(); return panorama_tools.sendShaderViewTo('preview_3d','extras');}")
        
        #Slider change events
        previewPitch.change(None, [previewPitch], None, _js="(v) => {panorama_tools.setParameter('pitch', v, 'preview_3d')}")
        previewYaw.change(None, [previewYaw], None, _js="(v) => {panorama_tools.setParameter('yaw', v, 'preview_3d')}")
        previewFov.change(None, [previewFov], None, _js="(v) => {panorama_tools.setParameter('fov', v, 'preview_3d')}")

        reorientPitch.change(None, [reorientPitch], None, _js="(v) => {panorama_tools.setParameter('reorientPitch', v)}")
        reorientYaw.change(None, [reorientYaw], None, _js="(v) => {panorama_tools.setParameter('reorientYaw', v)}")
        offsetBottom.change(None, [offsetBottom], None, _js="(v) => {panorama_tools.setParameter('offsetBottom', v)}")
        offsetTop.change(None, [offsetTop], None, _js="(v) => {panorama_tools.setParameter('offsetTop', v)}")

        inpaintEnable.change(None, [inpaintEnable], None, _js="(v) => {panorama_tools.setParameter('maskEnable', (v ? 1.0:0.0))}")
        inpaintPitch.change(None, [inpaintPitch], None, _js="(v) => {panorama_tools.setParameter('maskPitch', v)}")
        inpaintYaw.change(None, [inpaintYaw], None, _js="(v) => {panorama_tools.setParameter('maskYaw', v)}")
        inpaintFov.change(None, [inpaintFov], None, _js="(v) => {panorama_tools.setParameter('maskFov', v)}")
        inpaintMaskBlur.change(None, [inpaintMaskBlur], None, _js="(v) => {panorama_tools.setParameter('maskBlend', v)}")

        previewWidth.change(None, [previewWidth, previewHeight], None, _js="(w,h) => {panorama_tools.updateResolution('preview_3d', w, h)}")
        previewHeight.change(None, [previewWidth, previewHeight], None, _js="(w,h) => {panorama_tools.updateResolution('preview_3d', w, h)}")
        panoramaWidth.change(None, [panoramaWidth, panoramaHeight], None, _js="(w,h) => {panorama_tools.updateResolution('preview_2d', w, h, true)}")
        panoramaHeight.change(None, [panoramaWidth, panoramaHeight], None, _js="(w,h) => {panorama_tools.updateResolution('preview_2d', w, h, true)}")

        #Image input change events
        panorama_input_image.change(None, [panorama_input_image], None, _js="(url) => {panorama_tools.loadPanoramaImage(url)}")
        panorama_inpaint_input_image.change(None, [panorama_inpaint_input_image], None,  _js="(url) => {panorama_tools.loadInpaintImage(url)}")
        
        #Initial loading
        panorama_input_image.value=baseUrl+"/images/default_panorama.png"
        panorama_tools_ui.load(None, inputs=[], outputs=[], _js="() => {panorama_tools.initialize('"+baseUrl+"','"+baseUrl+defaultImage+"')}")

    return [(panorama_tools_ui, "Panorama Tools", "panorama-tools")]

def after_component(component, **kwargs):
    #Find the image input elements for "send to" buttons.
    for name, sendto_input in sendto_inputs.items():
        if kwargs.get("elem_id") == sendto_input["elem_id"]:
            sendto_input["component"] = component

script_callbacks.on_ui_tabs(on_ui_tabs)
script_callbacks.on_after_component(after_component)

baseUrl = get_extension_base_url();








