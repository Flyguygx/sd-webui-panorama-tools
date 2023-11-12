PanoramaViewer = async function(baseUrl, canvasId)
{
    //Pre-defined constants
    let defaultColor = [128,128,128,255];
    let angleResolution = 2;
    let fovResolution = 2;
    let zoomSensitivity = 0.05; //Degrees FOV per scroll unit

    //Variables
    let cameraState =
    {
        yaw:    0.00,
        pitch:  0.00,
        fov:   90.00,
    }

    let mouse =
    {
        over: false,
        dragging: false
    }

    let panoramaTexture = null;

    let mouseOverViewer3D = false; //Mouse is over 3D preview
    let mouseDragViewer3D = false; //Click and drag started in 3D preview

    let shaderView = null;

    let initialize = async function(baseUrl, canvasId)
    {
        let vertShaderPath =   baseUrl + "/shaders/default.vert";
        let viewerShaderPath = baseUrl + "/shaders/panorama_preview.frag";

        shaderView = await ShaderView(canvasId, vertShaderPath, viewerShaderPath);

        //Viewer canvas events
        let viewerCanvas = shaderView.canvas;
        viewerCanvas.onmousedown = function(e){if(e.buttons&1 === 1){mouse.drag = true;}}
        viewerCanvas.onmouseover = function(e){mouse.over = true;}
        viewerCanvas.onmouseout = function(e){mouse.drag = false;}

        viewerCanvas.onmouseup = function(e){if(e.buttons&1 === 1){mouse.drag = false;} e.preventDefault();}
        viewerCanvas.onmousemove = function(e){onMouseMove(e)};    
        viewerCanvas.onwheel = function(e){onMouseWheel(e)};

        //Setup render-to texture for 3D preview
        panoramaTexture = shaderView.addPlaceholderTexture("equirectangular", defaultColor);

        draw();
    }

    //Handles mouse rotation for 3d preview if drag started in 3d preview.
    let onMouseMove = function(e)
    {
        if(mouse.drag && shaderView.canvas.checkVisibility())
        {
            if(e.buttons & 1 === 1) //Left/Primary mouse button clicked
            {
                //Adjust mouse sensitivity with fov
                let canvasWidth = shaderView.canvas.clientWidth;
                let canvasHeight = shaderView.canvas.clientHeight;
                let mouseSensitivityPitch = cameraState.fov/canvasHeight;

                //Calculate horizontal FOV from vertical FOV.
                let focalLen = 1.0 / Math.tan(0.5*cameraState.fov * (Math.PI/180.0));
                let horizFov = 2.0 * Math.atan((canvasWidth/canvasHeight)/focalLen) * (180.0/Math.PI); 
                let mouseSensitivityYaw = horizFov / canvasWidth;
                
                let yaw = cameraState.yaw - mouseSensitivityYaw*e.movementX;
                let pitch = cameraState.pitch - mouseSensitivityPitch*-e.movementY;

                //Clamp pitch between +/-90deg, wrap yaw between +/-180deg
                pitch = Math.max(-90,Math.min(90,pitch));
                yaw = (((yaw+180)%360)+360)%360 - 180;
                
                cameraState.yaw = yaw.toFixed(angleResolution);
                cameraState.pitch = pitch.toFixed(angleResolution);
                draw();
                
                //Avoid selecting text while rotating view
                e.preventDefault();
            }
            else
            {
                mouse.over = false;
            }
        }
    }

    //Handles mouse zooming in 3d preview if the mouse is over it or while rotating the preview.
    let onMouseWheel = function(e)
    {
        if((mouse.over || mouse.drag) && shaderView.canvas.checkVisibility())
        {            
            cameraState.fov += e.deltaY * zoomSensitivity;
            cameraState.fov = Math.max(0,Math.min(180,cameraState.fov));

            draw();

            //Avoid scrolling while zooming view
            e.preventDefault();
        }
    }

    //Redraw a named shader view or all views if no name is given.
    let draw = function()
    {
        for (const [name, value] of Object.entries(cameraState)) 
        {
            shaderView.setVariable(name, value);
        }

        shaderView.draw()
    }

    //Update the resolution of the viewer
    let setResolution = function(width,height)
    {
        shaderView.setResolution(width, height);
        draw();
    }

    //Return a DataURL image of the named shader view.
    let getImageDataURL = function(shaderViewName)
    {
        return shaderView.getImageDataURL();//.canvas.toDataURL();
    }

    //Download an image og the specified shader view.
    let downloadImage = function(shaderViewName, filename = 'untitled.png') 
    {
        let data = shaderView.getImageDataURL();
        let a = document.createElement('a');
        a.href = data;
        a.download = filename;
        a.click();
    }

    let getTexture = function() 
    {
        return panoramaTexture;
    }

    let setPitch = function(v){cameraState.pitch = v;}
    let setYaw = function(v){cameraState.yaw = v;}
    let setFov = function(v){cameraState.fov = v;}
    let setCamera = function(v){cameraState = v;}

    let getPitch = function(){return cameraState.pitch;}
    let getYaw = function(){return cameraState.yaw;}
    let getFov = function(){return cameraState.fov;}
    let getCamera = function(){return cameraState;}

    await initialize(baseUrl, canvasId);
    
    //Exported functions to be called from Python
    return {
        draw,
        setPitch,
        setYaw,
        setFov,
        setCamera,
        setResolution,
        getPitch,
        getYaw,
        getFov,
        getCamera,
        getTexture,
        getImageDataURL,
        downloadImage
    };
}
