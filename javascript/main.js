shaderState =
{
    yaw: ["float", 0.0],
    pitch: ["float", 0.0],
    zoom: ["float", 1.0],
    maskYaw: ["float", 0.0],
    maskPitch: ["float", 0.0],
    maskZoom : ["float", 1.0],
    maskBlend: ["float", 0.0],
    maskEnable: ["float", 0.0],
    reorientYaw: ["float", 0.0],
    reorientPitch: ["float", 0.0],
    offsetTop: ["float", 0.0],
    offsetBottom: ["float", 0.0]
}

defaultColor = [128,128,128,255]

maxUndoSteps = 5
panoramaInputUndoBuffer = [];
inpaintInputUndoBuffer = [];

mouseOverPreview3D = false;
mouseDragPreview3D = false;

shaderViews = {};
textures = {};

async function initialize()
{
    
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

function tabMouseMove(e)
{
    if(mouseDragPreview3D)
    {
        if(e.buttons&1 === 1)
        {
            var canvasWidth = shaderViews["preview_3d"].canvas.clientWidth;
            var zoom = shaderState.zoom[1];
            var dragAmount = (180.0/Math.PI)*Math.atan(1.0/zoom)/(canvasWidth/2);
            
            var yaw = shaderState.yaw[1] - dragAmount*e.movementX;
            var pitch = shaderState.pitch[1] - dragAmount*e.movementY;

            pitch = Math.max(-90,Math.min(90,pitch));
            yaw = (((yaw+180)%360)+360)%360 - 180;

            setParameter('yaw', yaw.toFixed(2), 'preview_3d')
            setParameter('pitch', pitch.toFixed(2), 'preview_3d')
            updatePreviewSliders();
            e.preventDefault();
        }
        else
        {
            mouseDragPreview3D = false;
        }
    }
}

function tabMouseWheel(e)
{
    if(mouseDragPreview3D || mouseOverPreview3D)
    {
        var zoom = shaderState.zoom[1];

        if(e.deltaY < 0)
        {
            zoom = zoom*1.1;
        }
        else
        {
            zoom = zoom/1.1;
        }

        setParameter('zoom', zoom.toFixed(3), 'preview_3d')
        updatePreviewSliders()
        e.preventDefault();
    }
}

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

function updateCanvasTexture(dstShaderView, textureName, srcShaderViewName)
{
    var srcShaderViewCanvas = shaderViews[srcShaderViewName].glContext.canvas;
    var dstShaderView = dstShaderViewName;
    var gl = dstShaderView.glContext;
    var texture = dstShaderView.textures[textureName].glTexture;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, srcShaderViewCanvas);
    gl.generateMipmap(gl.TEXTURE_2D);
}

function setParameter(name, value, shaderViewName = "")
{
    shaderState[name][1] = value;

    redrawView(shaderViewName);
}

function updateUniforms(shaderView, shaderState)
{
    for (const [name, typeValue] of Object.entries(shaderState)) 
    {
        var test = setUniform(shaderView, typeValue[0], name, typeValue[1]);
    }
}

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

async function loadShader(gl, name, type)
{
    let shaderUrl = "file=extensions/sd-webui-panorama-tools/shaders/"
    let shaderSource = await (await fetch(shaderUrl+name)).text();
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

async function setupShaderView(canvasId, vertShaderName, fragShaderName)
{
    var canvas = gradioApp().querySelector(canvasId);
    gl = canvas.getContext('webgl2', {preserveDrawingBuffer:true});

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

    for(const renderToTexture of shaderView.renderToTextures)
    {
        var dstGLContext = renderToTexture.glContext;
        var texture = renderToTexture.glTexture;
    
        dstGLContext.bindTexture(gl.TEXTURE_2D, texture);
        dstGLContext.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, gl.canvas);
        dstGLContext.generateMipmap(gl.TEXTURE_2D);
    }
}

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

function currentPanoramaInputResolution() {
    var img = gradioApp().querySelector('#panorama_input_image img');
    return img ? [img.naturalWidth/4, img.naturalHeight/2, img.naturalWidth, img.naturalHeight] : [0, 0, 0, 0];
}

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

function getShaderViewImage(shaderViewName)
{
    return shaderViews[shaderViewName].canvas.toDataURL();
}

function sendShaderViewTo(shaderViewName, tab)
{
    if(tab === "img2img"){ switch_to_img2img() }
    if(tab === "inpaint"){ switch_to_inpaint() }
    if(tab === "extras"){ switch_to_extras() } 

    return shaderViews[shaderViewName].canvas.toDataURL();
}

function setGradioSliderValue(parent, elem_id, value)
{
    var slider = parent.querySelector("#"+elem_id+" input[type=number]");
    var number = parent.querySelector("#"+elem_id+" input[type=range]");

    slider.value = value;
    number.value = value;
}

function getGradioSliderValue(parent, elem_id, value)
{
    var number = parent.querySelector("#"+elem_id+" input[type=range]");

    return number.value;
}

function updatePreviewSliders()
{
    var gApp = gradioApp();
    setGradioSliderValue(gApp, "panorama_tools_preview_pitch", shaderState.pitch[1])
    setGradioSliderValue(gApp, "panorama_tools_preview_yaw", shaderState.yaw[1])
    setGradioSliderValue(gApp, "panorama_tools_preview_zoom", shaderState.zoom[1])
}

function copyPreviewSettingsToInpaint()
{
    var gApp = gradioApp();

    setGradioSliderValue(gApp, "panorama_tools_inpaint_pitch", shaderState.pitch[1])
    setGradioSliderValue(gApp, "panorama_tools_inpaint_yaw", shaderState.yaw[1])
    setGradioSliderValue(gApp, "panorama_tools_inpaint_zoom", shaderState.zoom[1])

    setParameter('maskPitch', shaderState.pitch[1])
    setParameter('maskYaw', shaderState.yaw[1])
    setParameter('maskZoom', shaderState.zoom[1])
}

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

function loadInpaintImage(url)
{
    loadTexture('preview_2d', 'inpainting', url)

    if(inpaintInputUndoBuffer.length >= maxUndoSteps)
    {
        inpaintInputUndoBuffer.shift();
    }

    inpaintInputUndoBuffer.push(url);
}

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

onUiLoaded(initialize);