panorama_tools = (function(){
    //Pre-defined constants
    let defaultResolution = [512, 512, 1024, 2048]; //Preview width/height, Panorama width/height
    let defaultColor = [128,128,128,255];
    let defaultFov = 90;
    let maxUndoSteps = 5;
    let angleResolution = 2;
    let fovResolution = 2;
    let zoomSensitivity = 0.05; //Degrees FOV per scroll unit
    let predefinedViews =
    {
        front: {yaw:   0, pitch:  0},
        back:  {yaw: 180, pitch:  0},
        left:  {yaw: -90, pitch:  0},
        right: {yaw:  90, pitch:  0},
        up:    {yaw:   0, pitch: 90},
        down:  {yaw:   0, pitch:-90},
    }

    //Variables
    let extensionBaseUrl = "";
    let panoramaInputUndoBuffer = [];
    let inpaintInputUndoBuffer = [];
    let lastPreviewSettings = {yaw: 0, pitch: 0, fov: defaultFov};
    let shaderState = //Shader state variables
    {
        yaw:           0.00,
        pitch:         0.00,
        fov:          90.00,
        maskYaw:       0.00,
        maskPitch:     0.00,
        maskFov :     90.00,
        maskBlend:     0.01,
        maskEnable:    0.00,
        reorientYaw:   0.00,
        reorientPitch: 0.00,
        offsetTop:     0.00,
        offsetBottom:  0.00
    }

    let mouseOverPreview3D = false; //Mouse is over 3D preview
    let mouseDragPreview3D = false; //Click and drag started in 3D preview
    let mouseOverViewer3D = false; //Mouse is over 3D preview
    let mouseDragViewer3D = false; //Click and drag started in 3D preview

    let shaderViews = {};

    let initialize = async function(baseUrl, defaultImgUrl)
    {
        extensionBaseUrl = baseUrl;

        let vertShaderPath =      extensionBaseUrl + "/shaders/default.vert";
        let preview2DShaderPath = extensionBaseUrl + "/shaders/equirectangular_preview.frag";
        let preview3DShaderPath = extensionBaseUrl + "/shaders/panorama_preview.frag";
        let viewerShaderPath =    extensionBaseUrl + "/shaders/panorama_preview.frag";

        shaderViews["preview_2d"] = await ShaderView('#panotools_equirectangular_canvas',vertShaderPath, preview2DShaderPath);
        shaderViews["preview_3d"] = await ShaderView('#panotools_preview_canvas', vertShaderPath, preview3DShaderPath);
        shaderViews["viewer_3d"] = await ShaderView('#panotools_viewer_canvas', vertShaderPath, viewerShaderPath);

        //Preview canvas events
        let preview3DCanvas = shaderViews["preview_3d"].canvas;
        preview3DCanvas.onmousedown = function(e){if(e.buttons&1 === 1){mouseDragPreview3D = true;}}
        preview3DCanvas.onmouseover = function(e){mouseOverPreview3D = true;}
        preview3DCanvas.onmouseout = function(e){mouseOverPreview3D = false;}

        //Viewer canvas events
        let viewer3DCanvas = shaderViews["viewer_3d"].canvas;
        viewer3DCanvas.onmousedown = function(e){if(e.buttons&1 === 1){mouseDragViewer3D = true;}}
        viewer3DCanvas.onmouseover = function(e){mouseOverViewer3D = true;}
        viewer3DCanvas.onmouseout = function(e){mouseDragViewer3D = false;}

        //Tab events
        let tab = gradioApp().querySelector("#tab_panorama-tools");
        tab.onmouseup = function(e){if(e.buttons&1 === 1){mouseDragPreview3D = false; mouseDragViewer3D = false} e.preventDefault();}
        tab.onmousemove = function(e){tabMouseMove(e)};    
        tab.onwheel = function(e){tabMouseWheel(e)};

        //Create place holder textures for shader views
        shaderViews["preview_2d"].addPlaceholderTexture("equirectangular", defaultColor);
        shaderViews["preview_2d"].addPlaceholderTexture("inpainting", defaultColor);

        //Setup render-to texture for 3D preview
        let previewTexture = shaderViews["preview_3d"].addPlaceholderTexture("equirectangular", defaultColor);
        let viewerTexture = shaderViews["viewer_3d"].addPlaceholderTexture("equirectangular", defaultColor);
        shaderViews["preview_2d"].addRenderToTexture(previewTexture);
        shaderViews["preview_2d"].addRenderToTexture(viewerTexture);

        loadPanoramaImage(defaultImgUrl)

        //Redraw all views
        redrawView("");
    }

    //Handles mouse rotation for 3d preview if drag started in 3d preview.
    let tabMouseMove = function(e)
    {
        if(mouseDragPreview3D || mouseDragViewer3D)
        {
            if(e.buttons & 1 === 1) //Left/Primary mouse button clicked
            {
                let shaderViewName = mouseDragPreview3D ? "preview_3d" :
                                     mouseDragViewer3D  ? "viewer_3d" : "";

                //Adjust mouse sensitivity with fov
                let canvasWidth = shaderViews[shaderViewName].canvas.clientWidth;
                let canvasHeight = shaderViews[shaderViewName].canvas.clientHeight;
                let mouseSensitivityPitch = shaderState.fov/canvasHeight;

                //Calculate horizontal FOV from vertical FOV.
                let focalLen = 1.0 / Math.tan(0.5*shaderState.fov * (Math.PI/180.0));
                let horizFov = 2.0 * Math.atan((canvasWidth/canvasHeight)/focalLen) * (180.0/Math.PI); 
                let mouseSensitivityYaw = horizFov / canvasWidth;
                
                let yaw = shaderState.yaw - mouseSensitivityYaw*e.movementX;
                let pitch = shaderState.pitch - mouseSensitivityPitch*-e.movementY;

                //Clamp pitch between +/-90deg, wrap yaw between +/-180deg
                pitch = Math.max(-90,Math.min(90,pitch));
                yaw = (((yaw+180)%360)+360)%360 - 180;
                
                setParameter('yaw', yaw.toFixed(angleResolution), shaderViewName, false);
                setParameter('pitch', pitch.toFixed(angleResolution), shaderViewName);
                updatePreviewSliders();
                
                //Avoid selecting text while rotating view
                e.preventDefault();
            }
            else
            {
                mouseDragPreview3D = false;
                mouseDragViewer3D = false;
            }
        }
    }

    //Handles mouse zooming in 3d preview if the mouse is over it or while rotating the preview.
    let tabMouseWheel = function(e)
    {
        let zoomPreview3D = mouseDragPreview3D || mouseOverPreview3D;
        let zoomViewer3D = mouseDragViewer3D || mouseOverViewer3D;
        if(zoomPreview3D || zoomViewer3D)
        {
            let shaderViewName = zoomPreview3D ? "preview_3d" :
                                 zoomViewer3D  ? "viewer_3d" : "";

            let fov = parseFloat(shaderState.fov);
            
            fov += e.deltaY * zoomSensitivity;
            fov = Math.max(0,Math.min(180,fov));

            setParameter('fov', fov.toFixed(fovResolution), shaderViewName);
            updatePreviewSliders()

            //Avoid scrolling while zooming view
            e.preventDefault();
        }
    }

    //Redraw a named shader view or all views if no name is given.
    let redrawView = function(name)
    {
        if(name === "") //Update all if no view specified
        {
            for (const [viewName, shaderView] of Object.entries(shaderViews)) 
            {
                updateShaderState(shaderView, shaderState);
                //drawShaderView(shaderView);
                shaderView.draw()
            }
        }
        else
        {
            updateShaderState(shaderViews[name], shaderState);
            //drawShaderView(shaderViews[name]);
            shaderViews[name].draw();
        }
    }

    //Set a named shader state parameter and re-draw all or a named shader view.
    let setParameter = function(name, value, shaderViewName = "", redraw = true)
    {
        shaderState[name] = value;
        if(redraw)
        {
            redrawView(shaderViewName);
        }
    }

    //Update a list of shader uniforms for a given shader view
    //list format: name:{type:"float",value:1234}
    let updateShaderState = function(shaderView, shaderState)
    {
        for (const [name, value] of Object.entries(shaderState)) 
        {
            let test = shaderView.setVariable(name, value);
        }
    }

    //Update the resolution of a named shader view, optionally redraw all views (for dependent render-to textures)
    let updateResolution = function(name,width,height,redrawAll=false)
    {
        shaderViews[name].setResolution(width, height);

        if(redrawAll)
        {
            redrawView("");
        }
        else
        {
            redrawView(name);
        }
    }

    //Returns the preview resolution calculated from the input resolution & input resolution
    let viewResolutionFromInput = function() 
    {
        let img = gradioApp().querySelector('#panorama_input_image img');
        return img ? [img.naturalWidth/4, img.naturalHeight/2, img.naturalWidth, img.naturalHeight] : defaultResolution;
    }

    //Returns the preview resolution calculated from the input resolution & input resolution
    let viewResolutionFromInpaint = function() 
    {
        let img = gradioApp().querySelector('#panorama_inpaint_input_image img');
        return img ? [img.naturalWidth, img.naturalHeight, img.naturalWidth*4, img.naturalHeight*2] : defaultResolution;
    }
    

    //Gets the selected image (or first if none selected) in the gallery of the specified webui tab.
    let getSelectedImageOnTab = function(tab)
    {
        let queryStr = (tab === "txt2img") ? "#txt2img_gallery img" :
                    (tab === "img2img") ? "#img2img_gallery img" :
                    (tab === "extras") ? "#extras_gallery img" :
                    null;
        
        let img = gradioApp().querySelector(queryStr);

        if(tab !== null && img)
        {
            return img.src;
        }
        return ""
    }

    //Return a DataURL image of the named shader view.
    let getShaderViewImage = function(shaderViewName)
    {
        return shaderViews[shaderViewName].getImageDataURL();//.canvas.toDataURL();
    }

    //Returns a DataURL image of the named shader view and switches to the specified tab.
    //Must be called from python with the specified tab's image component as the output.
    let sendShaderViewTo = function(shaderViewName, tab)
    {
        if(tab === "img2img"){ switch_to_img2img() }
        if(tab === "inpaint"){ switch_to_inpaint() }
        if(tab === "extras"){ switch_to_extras() } 

        return shaderViews[shaderViewName].getImageDataURL();//.canvas.toDataURL();
    }

    //Set the value of a Gradio slider.
    //Caution - Doesn't relay changes back to Gradio so Python code using the slider value will go out of sync.
    let setGradioSliderValue = function(parent, elem_id, value)
    {
        let slider = parent.querySelector("#"+elem_id+" input[type=number]");
        let number = parent.querySelector("#"+elem_id+" input[type=range]");

        slider.value = value;
        number.value = value;
    }

    //Get the value of a Gradio slider.
    let getGradioSliderValue = function(parent, elem_id)
    {
        let number = parent.querySelector("#"+elem_id+" input[type=range]");

        return number.value;
    }

    //Update the preview sliders to match the shader state parameters.
    let updatePreviewSliders = function()
    {
        let gApp = gradioApp();
        setGradioSliderValue(gApp, "panorama_tools_preview_pitch", shaderState.pitch)
        setGradioSliderValue(gApp, "panorama_tools_preview_yaw", shaderState.yaw)
        setGradioSliderValue(gApp, "panorama_tools_preview_fov", shaderState.fov)
    }

    //Copy the preview slider values to the inpainting sliders to align inpainting with current view.
    let copyPreviewSettingsToInpaint = function()
    {
        let gApp = gradioApp();

        setGradioSliderValue(gApp, "panorama_tools_inpaint_pitch", shaderState.pitch)
        setGradioSliderValue(gApp, "panorama_tools_inpaint_yaw", shaderState.yaw)
        setGradioSliderValue(gApp, "panorama_tools_inpaint_fov", shaderState.fov)

        setParameter('maskPitch', shaderState.pitch)
        setParameter('maskYaw', shaderState.yaw)
        setParameter('maskFov', shaderState.fov)
    }

    //Laod panorama image to both 2d/3d previews, add to undo buffer.
    let loadPanoramaImage = function(url)
    {
        //loadTexture('preview_2d', 'equirectangular', url);
        shaderViews['preview_2d'].loadTexture('equirectangular', url, function(loaded){
            redrawView("");
        });

        if(panoramaInputUndoBuffer.length >= maxUndoSteps)
        {
            panoramaInputUndoBuffer.shift();
        }

        panoramaInputUndoBuffer.push(url);
    }

    //Revert to previous panorama image.
    let revertPanoramaImage = function()
    {
        let curImage = panoramaInputUndoBuffer.pop();
        if(panoramaInputUndoBuffer.length >= 1)
        {
            return panoramaInputUndoBuffer.pop();
        }
        else
        {
            panoramaInputUndoBuffer.push(curImage);
            return curImage;
        }
    }

    //Laod inpainting image to both 2d/3d previews, add to undo buffer.
    let loadInpaintImage = function(url)
    {
        //loadTexture('preview_2d', 'inpainting', url)
        shaderViews['preview_2d'].loadTexture('inpainting', url, function(loaded){
            redrawView("");
        });

        if(inpaintInputUndoBuffer.length >= maxUndoSteps)
        {
            inpaintInputUndoBuffer.shift();
        }

        inpaintInputUndoBuffer.push(url);
    }

    //Revert to previous inpainting image.
    let revertInpaintImage = function()
    {
        let curImage = inpaintInputUndoBuffer.pop();
        if(inpaintInputUndoBuffer.length >= 1)
        {
            return inpaintInputUndoBuffer.pop();
        }
        else
        {
            inpaintInputUndoBuffer.push(curImage);
            return curImage;
        }
    }

    //Download an image og the specified shader view.
    let downloadShaderViewImage = function(shaderViewName, filename = 'untitled.png') {
        //let canvas = shaderViews[shaderViewName].canvas;
        let data = shaderViews[shaderViewName].getImageDataURL();//canvas.toDataURL("image/png", 1.0);
        let a = document.createElement('a');
        a.href = data;
        a.download = filename;
        a.click();
    }

    //Set the 3D preview to show named pre-defined view.
    let setPredefinedView = function(viewName)
    {
        let gApp = gradioApp();
        let preDefView = predefinedViews[viewName];
        if(preDefView)
        {
            setParameter('pitch', preDefView.pitch)
            setParameter('yaw', preDefView.yaw)

            setGradioSliderValue(gApp, "panorama_tools_preview_pitch", preDefView.pitch)
            setGradioSliderValue(gApp, "panorama_tools_preview_yaw", preDefView.yaw)
        }
    }

    //Save the preview settings
    let savePreviewSettings = function()
    {
        lastPreviewSettings.yaw = shaderState.yaw;
        lastPreviewSettings.pitch = shaderState.pitch;
        lastPreviewSettings.fov = shaderState.fov;
    }

    //Send the last saved preview settings to inpaint
    let copyLastPreviewSettingsToInpaint = function()
    {
        let gApp = gradioApp();

        setGradioSliderValue(gApp, "panorama_tools_inpaint_pitch", lastPreviewSettings.pitch);
        setGradioSliderValue(gApp, "panorama_tools_inpaint_yaw", lastPreviewSettings.yaw);
        setGradioSliderValue(gApp, "panorama_tools_inpaint_fov", lastPreviewSettings.fov);

        setParameter('maskPitch', lastPreviewSettings.pitch);
        setParameter('maskYaw', lastPreviewSettings.yaw);
        setParameter('maskFov', lastPreviewSettings.fov);
    }

    //Renders cubemap faces and returns a list with the image data for each face.
    //TODO:Find a faster way to do this, passing dataURLs to Gradio is quite slow for large images.
    let renderCubemapFaces = function()
    {
        let shaderViewName = "preview_3d";
        let canvas = shaderViews[shaderViewName].canvas;
        let curPitch = shaderState.pitch;
        let curYaw = shaderState.yaw;
        let curFov = shaderState.fov;
        let faces = [];

        let faceAngles = [
            {yaw: -90, pitch:  0}, //left
            {yaw:   0, pitch:  0}, //front
            {yaw:  90, pitch:  0}, //right            
            {yaw: 180, pitch:  0}, //back
            {yaw:   0, pitch: 90}, //up
            {yaw:   0, pitch:-90}  //down
        ];
        
        setParameter('fov', 90, shaderViewName, false);

        for(const face of faceAngles)
        {
            setParameter('pitch', face.pitch, shaderViewName, false);
            setParameter('yaw', face.yaw, shaderViewName, false);
            redrawView(shaderViewName);
            
            let data = canvas.toDataURL("image/png", 1.0);
            faces.push(data);
        }

        //Reset view angles
        setParameter('pitch', curPitch, shaderViewName, false);
        setParameter('yaw', curYaw, shaderViewName, false);
        setParameter('fov', curFov, shaderViewName, false);
        redrawView(shaderViewName);

        return faces;
    }

    let setPreviewPitch = function(v){setParameter('pitch', v, 'preview_3d');}
    let setPreviewYaw = function(v){setParameter('yaw', v, 'preview_3d');}
    let setPreviewFov = function(v){setParameter('fov', v, 'preview_3d');}
    
    let setReorientPitch = function(v){setParameter('reorientPitch', v);}
    let setReorientYaw = function(v){setParameter('reorientYaw', v);}
    let setPoleOffsetBottom = function(v){setParameter('offsetBottom', v);}
    let setPoleOffsetTop = function(v){setParameter('offsetTop', v);}

    let setInpaintEnable = function(v){setParameter('maskEnable', (v ? 1.0:0.0));}
    let setInpaintPitch = function(v){setParameter('maskPitch', v);}
    let setInpaintYaw = function(v){setParameter('maskYaw', v);}
    let setInpaintFov = function(v){setParameter('maskFov', v);}
    let setInpaintMaskBlur = function(v){setParameter('maskBlend', v);}

    //Exported functions to be called from Python
    return {
        initialize,

        loadPanoramaImage,
        loadInpaintImage,
        revertPanoramaImage,
        revertInpaintImage,
        getSelectedImageOnTab,
        getShaderViewImage,
        renderCubemapFaces,

        setPredefinedView,
        viewResolutionFromInput,
        viewResolutionFromInpaint,

        sendShaderViewTo,
        downloadShaderViewImage,

        setParameter,
        updateResolution,
        savePreviewSettings,
        copyLastPreviewSettingsToInpaint,
        copyPreviewSettingsToInpaint,

        setPreviewPitch,
        setPreviewYaw,
        setPreviewFov,

        setReorientPitch,
        setReorientYaw,
        setPoleOffsetBottom,
        setPoleOffsetTop,

        setInpaintEnable,
        setInpaintPitch,
        setInpaintYaw,
        setInpaintFov,
        setInpaintMaskBlur
    };
})();
