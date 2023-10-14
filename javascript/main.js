//Shader state variables
shaderState =
{
    yaw:           {type: "float", value: 0.0},
    pitch:         {type: "float", value: 0.0},
    zoom:          {type: "float", value: 1.0},
    maskYaw:       {type: "float", value: 0.0},
    maskPitch:     {type: "float", value: 0.0},
    maskZoom :     {type: "float", value: 1.0},
    maskBlend:     {type: "float", value: 0.0},
    maskEnable:    {type: "float", value: 0.0},
    reorientYaw:   {type: "float", value: 0.0},
    reorientPitch: {type: "float", value: 0.0},
    offsetTop:     {type: "float", value: 0.0},
    offsetBottom:  {type: "float", value: 0.0}
}

defaultColor = [128,128,128,255]
maxUndoSteps = 5
angleResolution = 2
zoomResolution = 3

extensionBaseUrl = ""
panoramaInputUndoBuffer = [];
inpaintInputUndoBuffer = [];

mouseOverPreview3D = false;
mouseDragPreview3D = false;

shaderViews = {};
textures = {};

async function initialize(baseUrl)
{
    extensionBaseUrl = baseUrl;
    
    shaderViews["preview_2d"] = await setupShaderView('#panotools_equirectangular_canvas','default.vert','equirectangular_preview.frag');
    shaderViews["preview_3d"] = await setupShaderView('#panotools_preview_canvas','default.vert','panorama_preview.frag');

    //Preview canvas events
    var preview3DCanvas = shaderViews["preview_3d"].canvas;
    preview3DCanvas.onmousedown = function(e){if(e.buttons&1 === 1){mouseDragPreview3D = true;}}
    preview3DCanvas.onmouseover = function(e){mouseOverPreview3D = true;}
    preview3DCanvas.onmouseout = function(e){mouseOverPreview3D = false;}

    //Tab events
    var tab = gradioApp().querySelector("#tab_panorama-tools");
    tab.onmouseup = function(e){if(e.buttons&1 === 1){mouseDragPreview3D = false;} e.preventDefault();}
    tab.onmousemove = function(e){tabMouseMove(e)};    
    tab.onwheel = function(e){tabMouseWheel(e)};

    var previewTexture = createPlaceholderTexture(shaderViews["preview_3d"], "equirectangular", defaultColor);
    createPlaceholderTexture(shaderViews["preview_2d"], "equirectangular", defaultColor);
    createPlaceholderTexture(shaderViews["preview_2d"], "inpainting", defaultColor);

    shaderViews["preview_2d"].renderToTextures.push(previewTexture);

    redrawView("");
}

//Handles mouse rotation for 3d preview if drag started in 3d preview.
function tabMouseMove(e)
{
    if(mouseDragPreview3D)
    {
        if(e.buttons & 1 === 1) //Left/Primary mouse button clicked
        {
            //Adjust mouse sensitivity with zoom
            var canvasWidth = shaderViews["preview_3d"].canvas.clientWidth;
            var zoom = shaderState.zoom.value;
            var mouseSensitivity = (180.0/Math.PI)*Math.atan(1.0/zoom)/(canvasWidth/2);
            
            var yaw = shaderState.yaw.value - mouseSensitivity*e.movementX;
            var pitch = shaderState.pitch.value - mouseSensitivity*-e.movementY;

            //Clamp pitch between +/-90deg, wrap yaw between +/-180deg
            pitch = Math.max(-90,Math.min(90,pitch));
            yaw = (((yaw+180)%360)+360)%360 - 180;
            
            setParameter('yaw', yaw.toFixed(angleResolution), 'preview_3d')
            setParameter('pitch', pitch.toFixed(angleResolution), 'preview_3d')
            updatePreviewSliders();
            e.preventDefault();
        }
        else
        {
            mouseDragPreview3D = false;
        }
    }
}

//Handles mouse zooming in 3d preview if the mouse is over it or while rotating the preview.
function tabMouseWheel(e)
{
    if(mouseDragPreview3D || mouseOverPreview3D)
    {
        var zoom = shaderState.zoom.value;

        if(e.deltaY < 0)
        {
            zoom = zoom*1.1;
        }
        else
        {
            zoom = zoom/1.1;
        }

        setParameter('zoom', zoom.toFixed(zoomResolution), 'preview_3d')
        updatePreviewSliders()
        e.preventDefault();
    }
}

//Redraw a named shader view or all views if no name is given.
function redrawView(name)
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
function createPlaceholderTexture(shaderView, name, color = [0,0,0,255])
{
    var gl = shaderView.glContext;
    var texture = gl.createTexture();

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
function loadTexture(shaderViewName, name, url)
{
    var shaderView = shaderViews[shaderViewName];
    var gl = shaderView.glContext;
    var texture = shaderView.textures[name].glTexture;

    if(url)
    {
        var image = new Image();
        image.src = url;
        image.onload = function() 
        {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_2D);

            redrawView("");
        };
    }
    else //Handle image being cleared
    {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(defaultColor));
        redrawView("");
    }
}

//Set a named shader state parameter and re-draw all or a named shader view.
function setParameter(name, value, shaderViewName = "")
{
    shaderState[name].value = value;

    redrawView(shaderViewName);
}

//Update a list of shader uniforms for a given shader view
//list format: name:{type:"float",value:1234}
function updateUniforms(shaderView, shaderState)
{
    for (const [name, typeValue] of Object.entries(shaderState)) 
    {
        var test = setUniform(shaderView, typeValue.type, name, typeValue.value);
    }
}

//Set the value of a named uniform of a given type on a shader view.
function setUniform(shaderView, type, name, value)
{
    var gl = shaderView.glContext;
    var loc = gl.getUniformLocation(shaderView.shaderProgram, name);
    if(loc === null)
    {
        return false;
    }

    var typeMapping = 
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
async function loadShader(gl, name, type)
{
    let shaderUrl = extensionBaseUrl+"/shaders/"+name
    let shaderSource = await (await fetch(shaderUrl)).text();
    var shader = gl.createShader(type);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);
    var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    var log = gl.getShaderInfoLog(shader);

    return {
        shader: shader,
        compiled: compiled,
        log: log
    }
}

//Sets up a basic full-screen triangle in webgl2 with vert/frag shaders.
async function setupShaderView(canvasId, vertShaderName, fragShaderName)
{
    var canvas = gradioApp().querySelector(canvasId);
    gl = canvas.getContext('webgl2', {preserveDrawingBuffer:true});

    //Setup triangle
    var vertices = [
        -1, -1, 0,
         3, -1, 0,
        -1,  3, 0, 
    ];
    indices = [0,1,2];

    var vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    var Index_Buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, Index_Buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    //Load shaders
    var vertShader = await loadShader(gl, vertShaderName, gl.VERTEX_SHADER);
    if(!vertShader.compiled)
    {
        console.log("Vertex shader failed to compile. Info:\n"+vertShader.log);
    }
    var fragShader = await loadShader(gl, fragShaderName, gl.FRAGMENT_SHADER);
    if(!fragShader.compiled)
    {
        console.log("Fragment shader failed to compile. Info:\n"+fragShader.log);
    }

    var shaderProgram = gl.createProgram();
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
function drawShaderView(shaderView)
{
    var gl = shaderView.glContext;
    gl.useProgram(shaderView.shaderProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, shaderView.vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shaderView.indexBuffer);
    var coord = gl.getAttribLocation(shaderView.shaderProgram, "coordinates");
    gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(coord);

    setUniform(shaderView, "vec2", "resolution", [shaderView.canvas.width, shaderView.canvas.height]);

    gl.viewport(0,0,shaderView.canvas.width, shaderView.canvas.height);

    //
    var unit = 0;
    for (const [name, texture] of Object.entries(shaderView.textures)) 
    {    
        var texLoc = gl.getUniformLocation(shaderView.shaderProgram, name);
        gl.uniform1i(texLoc, unit);  
        gl.activeTexture(gl.TEXTURE0+unit);
        gl.bindTexture(gl.TEXTURE_2D, texture.glTexture);
        unit++;
    }

    gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_SHORT,0);

    //Update assgned render-to textures.
    for(const renderToTexture of shaderView.renderToTextures)
    {
        var dstGLContext = renderToTexture.glContext;
        var texture = renderToTexture.glTexture;
    
        dstGLContext.bindTexture(gl.TEXTURE_2D, texture);
        dstGLContext.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, gl.canvas);
        dstGLContext.generateMipmap(gl.TEXTURE_2D);
    }
}

//Update the resolution of a named shader view, optionally redraw all views (for dependent render-to textures)
function updateResolution(name,width,height,redrawAll=false)
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
function viewResolutionFromInput() 
{
    var img = gradioApp().querySelector('#panorama_input_image img');
    return img ? [img.naturalWidth/4, img.naturalHeight/2, img.naturalWidth, img.naturalHeight] : [512, 512, 1024, 2048];
}

//Gets the selected image (or first if none selected) in the gallery of the specified webui tab.
function getSelectedImageOnTab(tab)
{
    var queryStr = (tab === "txt2img") ? "#txt2img_gallery img" :
                   (tab === "img2img") ? "#img2img_gallery img" :
                   (tab === "extras") ? "#extras_gallery img" :
                   null;
    
    var img = gradioApp().querySelector(queryStr);

    if(tab !== null && img)
    {
        return img.src;
    }
    return ""
}

//Return a DataURL image of the named shader view.
function getShaderViewImage(shaderViewName)
{
    return shaderViews[shaderViewName].canvas.toDataURL();
}

//Returns a DataURL image of the named shader view and switches to the specified tab.
//Must be called from python with the specified tab's image component as the output.
function sendShaderViewTo(shaderViewName, tab)
{
    if(tab === "img2img"){ switch_to_img2img() }
    if(tab === "inpaint"){ switch_to_inpaint() }
    if(tab === "extras"){ switch_to_extras() } 

    return shaderViews[shaderViewName].canvas.toDataURL();
}

//Set the value of a Gradio slider.
//Caution - Doesn't relay changes back to Gradio so Python code using the slider value will go out of sync.
function setGradioSliderValue(parent, elem_id, value)
{
    var slider = parent.querySelector("#"+elem_id+" input[type=number]");
    var number = parent.querySelector("#"+elem_id+" input[type=range]");

    slider.value = value;
    number.value = value;
}

//Get the value of a Gradio slider.
function getGradioSliderValue(parent, elem_id)
{
    var number = parent.querySelector("#"+elem_id+" input[type=range]");

    return number.value;
}

//Update the preview sliders to match the shader state parameters.
function updatePreviewSliders()
{
    var gApp = gradioApp();
    setGradioSliderValue(gApp, "panorama_tools_preview_pitch", shaderState.pitch.value)
    setGradioSliderValue(gApp, "panorama_tools_preview_yaw", shaderState.yaw.value)
    setGradioSliderValue(gApp, "panorama_tools_preview_zoom", shaderState.zoom.value)
}

//Copy the preview slider values to the inpainting sliders to align inpainting with current view.
function copyPreviewSettingsToInpaint()
{
    var gApp = gradioApp();

    setGradioSliderValue(gApp, "panorama_tools_inpaint_pitch", shaderState.pitch.value)
    setGradioSliderValue(gApp, "panorama_tools_inpaint_yaw", shaderState.yaw.value)
    setGradioSliderValue(gApp, "panorama_tools_inpaint_zoom", shaderState.zoom.value)

    setParameter('maskPitch', shaderState.pitch.value)
    setParameter('maskYaw', shaderState.yaw.value)
    setParameter('maskZoom', shaderState.zoom.value)
}

//Laod panorama image to both 2d/3d previews, add to undo buffer.
function loadPanoramaImage(url)
{
    loadTexture('preview_3d', 'equirectangular', url); 
    loadTexture('preview_2d', 'equirectangular', url);

    if(panoramaInputUndoBuffer.length >= maxUndoSteps)
    {
        panoramaInputUndoBuffer.shift();
    }

    panoramaInputUndoBuffer.push(url);
}

//Revert to previous panorama image.
function revertPanoramaImage()
{
    var curImage = panoramaInputUndoBuffer.pop();
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
function loadInpaintImage(url)
{
    loadTexture('preview_2d', 'inpainting', url)

    if(inpaintInputUndoBuffer.length >= maxUndoSteps)
    {
        inpaintInputUndoBuffer.shift();
    }

    inpaintInputUndoBuffer.push(url);
}

//Revert to previous inpainting image.
function revertInpaintImage()
{
    var curImage = inpaintInputUndoBuffer.pop();
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
function downloadShaderViewImage(shaderViewName, filename = 'untitled.png') {
    var canvas = shaderViews[shaderViewName].canvas;
    var data = canvas.toDataURL("image/png", 1.0);
    var a = document.createElement('a');
    a.href = data;
    a.download = filename;
    a.click();
}

//onUiLoaded(initialize);