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
        yaw:           {type: "float", value:  0.00},
        pitch:         {type: "float", value:  0.00},
        fov:           {type: "float", value: 90.00},
        maskYaw:       {type: "float", value:  0.00},
        maskPitch:     {type: "float", value:  0.00},
        maskFov :      {type: "float", value: 90.00},
        maskBlend:     {type: "float", value:  0.01},
        maskEnable:    {type: "float", value:  0.00},
        reorientYaw:   {type: "float", value:  0.00},
        reorientPitch: {type: "float", value:  0.00},
        offsetTop:     {type: "float", value:  0.00},
        offsetBottom:  {type: "float", value:  0.00}
    }

    let mouseOverPreview3D = false; //Mouse is over 3D preview
    let mouseDragPreview3D = false; //Click and drag started in 3D preview
    let mouseOverViewer3D = false; //Mouse is over 3D preview
    let mouseDragViewer3D = false; //Click and drag started in 3D preview

    let shaderViews = {};

    let initialize = async function(baseUrl, defaultImgUrl)
    {
        extensionBaseUrl = baseUrl;
        
        shaderViews["preview_2d"] = await setupShaderView('#panotools_equirectangular_canvas','default.vert','equirectangular_preview.frag');
        shaderViews["preview_3d"] = await setupShaderView('#panotools_preview_canvas','default.vert','panorama_preview.frag');
        shaderViews["viewer_3d"] = await setupShaderView('#panotools_viewer_canvas','default.vert','panorama_preview.frag');

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
        createPlaceholderTexture(shaderViews["preview_2d"], "equirectangular", defaultColor);
        createPlaceholderTexture(shaderViews["preview_2d"], "inpainting", defaultColor);

        //Setup render-to texture for 3D preview
        let previewTexture = createPlaceholderTexture(shaderViews["preview_3d"], "equirectangular", defaultColor);
        let viewerTexture = createPlaceholderTexture(shaderViews["viewer_3d"], "equirectangular", defaultColor);
        shaderViews["preview_2d"].renderToTextures.push(previewTexture);
        shaderViews["preview_2d"].renderToTextures.push(viewerTexture);

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
                let mouseSensitivityPitch = shaderState.fov.value/canvasHeight;

                //Calculate horizontal FOV from vertical FOV.
                let focalLen = 1.0 / Math.tan(0.5*shaderState.fov.value * (Math.PI/180.0));
                let horizFov = 2.0 * Math.atan((canvasWidth/canvasHeight)/focalLen) * (180.0/Math.PI); 
                let mouseSensitivityYaw = horizFov / canvasWidth;
                
                let yaw = shaderState.yaw.value - mouseSensitivityYaw*e.movementX;
                let pitch = shaderState.pitch.value - mouseSensitivityPitch*-e.movementY;

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

            let fov = parseFloat(shaderState.fov.value);
            
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
                updateUniforms(shaderView, shaderState);
                drawShaderView(shaderView);
            }
        }
        else
        {
            updateUniforms(shaderViews[name], shaderState);
            drawShaderView(shaderViews[name]);
        }
    }

    //Creates a 1x1 texture with the specified color.
    let createPlaceholderTexture = function(shaderView, name, color = [0,0,0,255])
    {
        let gl = shaderView.glContext;
        let texture = gl.createTexture();

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(color));

        return shaderView.textures[name] = {
            glContext : gl,
            glTexture : texture
        };
    }

    //Load a texture from a URL
    let loadTexture = function(shaderViewName, name, url)
    {
        let shaderView = shaderViews[shaderViewName];
        let gl = shaderView.glContext;
        let texture = shaderView.textures[name].glTexture;

        if(url)
        {
            let image = new Image();
            image.src = url;
            image.onload = function() 
            {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, image);
                gl.generateMipmap(gl.TEXTURE_2D);

                redrawView("");
            };
        }
        else //Default to 1x1 texture with default color is url is blank/null/etc.
        {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(defaultColor));
            redrawView("");
        }
    }

    //Set a named shader state parameter and re-draw all or a named shader view.
    let setParameter = function(name, value, shaderViewName = "", redraw = true)
    {
        shaderState[name].value = value;
        if(redraw)
        {
            redrawView(shaderViewName);
        }
    }

    //Update a list of shader uniforms for a given shader view
    //list format: name:{type:"float",value:1234}
    let updateUniforms = function(shaderView, shaderState)
    {
        for (const [name, typeValue] of Object.entries(shaderState)) 
        {
            let test = setUniform(shaderView, typeValue.type, name, typeValue.value);
        }
    }

    //Set the value of a named uniform of a given type on a shader view.
    let setUniform = function(shaderView, type, name, value)
    {
        let gl = shaderView.glContext;
        let loc = gl.getUniformLocation(shaderView.shaderProgram, name);
        if(loc === null)
        {
            return false;
        }

        let typeMapping = 
        {
            float: "uniform1f",
            vec2: "uniform2fv",
            vec3: "uniform3fv",
            vec4: "uniform4fv",
            texture: "uniform1i"
        }

        if(!Object.hasOwn(typeMapping, type))
        {
            return false;
        }
        
        gl.useProgram(shaderView.shaderProgram);
        gl[typeMapping[type]](loc, value);
        
        return true;
    }

    //Load a named glsl shader into the given GL context
    let loadShader = async function(gl, name, type)
    {
        let shaderUrl = extensionBaseUrl+"/shaders/"+name
        let shaderSource = await (await fetch(shaderUrl)).text();
        let shader = gl.createShader(type);
        gl.shaderSource(shader, shaderSource);
        gl.compileShader(shader);
        let compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        let log = gl.getShaderInfoLog(shader);

        return {
            shader: shader,
            compiled: compiled,
            log: log
        }
    }

    //Sets up a basic full-screen triangle in webgl2 with vert/frag shaders.
    let setupShaderView = async function(canvasId, vertShaderName, fragShaderName)
    {
        let canvas = gradioApp().querySelector(canvasId);
        gl = canvas.getContext('webgl2', {preserveDrawingBuffer:true});

        //Setup triangle
        let vertices = [
            -1, -1, 0,
            3, -1, 0,
            -1,  3, 0, 
        ];
        indices = [0,1,2];

        let vertex_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        let Index_Buffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, Index_Buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        //Load shaders
        let vertShader = await loadShader(gl, vertShaderName, gl.VERTEX_SHADER);
        if(!vertShader.compiled)
        {
            console.log("Vertex shader failed to compile. Info:\n"+vertShader.log);
        }
        let fragShader = await loadShader(gl, fragShaderName, gl.FRAGMENT_SHADER);
        if(!fragShader.compiled)
        {
            console.log("Fragment shader failed to compile. Info:\n"+fragShader.log);
        }

        let shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertShader.shader);
        gl.attachShader(shaderProgram, fragShader.shader);
        gl.linkProgram(shaderProgram);
        
        return {
            canvas: canvas,
            glContext: gl,
            shaderProgram: shaderProgram,
            vertexBuffer: vertex_buffer,
            indexBuffer: Index_Buffer,
            textures: {},
            renderToTextures: []
        }
    }

    //Draws the given shader view and updates any assigned render-to textures.
    let drawShaderView = function(shaderView)
    {
        let gl = shaderView.glContext;
        gl.useProgram(shaderView.shaderProgram);

        gl.bindBuffer(gl.ARRAY_BUFFER, shaderView.vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shaderView.indexBuffer);
        let coord = gl.getAttribLocation(shaderView.shaderProgram, "coordinates");
        gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(coord);

        setUniform(shaderView, "vec2", "resolution", [shaderView.canvas.width, shaderView.canvas.height]);

        gl.viewport(0,0,shaderView.canvas.width, shaderView.canvas.height);

        //Bind assigned textures
        let unit = 0;
        for (const [name, texture] of Object.entries(shaderView.textures)) 
        {    
            let texLoc = gl.getUniformLocation(shaderView.shaderProgram, name);
            gl.uniform1i(texLoc, unit);  
            gl.activeTexture(gl.TEXTURE0+unit);
            gl.bindTexture(gl.TEXTURE_2D, texture.glTexture);
            unit++;
        }

        gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_SHORT,0);

        //Update assgned render-to textures.
        for(const renderToTexture of shaderView.renderToTextures)
        {
            let dstGLContext = renderToTexture.glContext;
            let texture = renderToTexture.glTexture;
        
            dstGLContext.bindTexture(gl.TEXTURE_2D, texture);
            dstGLContext.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, gl.canvas);
            dstGLContext.generateMipmap(gl.TEXTURE_2D);
        }
    }

    //Update the resolution of a named shader view, optionally redraw all views (for dependent render-to textures)
    let updateResolution = function(name,width,height,redrawAll=false)
    {
        shaderViews[name].canvas.width = width;
        shaderViews[name].canvas.height = height;
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
        return shaderViews[shaderViewName].canvas.toDataURL();
    }

    //Returns a DataURL image of the named shader view and switches to the specified tab.
    //Must be called from python with the specified tab's image component as the output.
    let sendShaderViewTo = function(shaderViewName, tab)
    {
        if(tab === "img2img"){ switch_to_img2img() }
        if(tab === "inpaint"){ switch_to_inpaint() }
        if(tab === "extras"){ switch_to_extras() } 

        return shaderViews[shaderViewName].canvas.toDataURL();
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
        setGradioSliderValue(gApp, "panorama_tools_preview_pitch", shaderState.pitch.value)
        setGradioSliderValue(gApp, "panorama_tools_preview_yaw", shaderState.yaw.value)
        setGradioSliderValue(gApp, "panorama_tools_preview_fov", shaderState.fov.value)
    }

    //Copy the preview slider values to the inpainting sliders to align inpainting with current view.
    let copyPreviewSettingsToInpaint = function()
    {
        let gApp = gradioApp();

        setGradioSliderValue(gApp, "panorama_tools_inpaint_pitch", shaderState.pitch.value)
        setGradioSliderValue(gApp, "panorama_tools_inpaint_yaw", shaderState.yaw.value)
        setGradioSliderValue(gApp, "panorama_tools_inpaint_fov", shaderState.fov.value)

        setParameter('maskPitch', shaderState.pitch.value)
        setParameter('maskYaw', shaderState.yaw.value)
        setParameter('maskFov', shaderState.fov.value)
    }

    //Laod panorama image to both 2d/3d previews, add to undo buffer.
    let loadPanoramaImage = function(url)
    {
        loadTexture('preview_2d', 'equirectangular', url);

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
        loadTexture('preview_2d', 'inpainting', url)

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
        let canvas = shaderViews[shaderViewName].canvas;
        let data = canvas.toDataURL("image/png", 1.0);
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
        lastPreviewSettings.yaw = shaderState.yaw.value;
        lastPreviewSettings.pitch = shaderState.pitch.value;
        lastPreviewSettings.fov = shaderState.fov.value;
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
        let curPitch = shaderState.pitch.value;
        let curYaw = shaderState.yaw.value;
        let curFov = shaderState.fov.value;
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

    //Exported functions to be called from Python
    return {
        initialize,
        loadPanoramaImage,
        loadInpaintImage,
        revertPanoramaImage,
        revertInpaintImage,
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
        getSelectedImageOnTab,
        getShaderViewImage,
        renderCubemapFaces
    };
})();
