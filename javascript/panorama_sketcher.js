PanoramaSketcher = async function(baseUrl, viewerCanvasId, previewCanvasId)
{
    let defaultColor = [0,0,0,255];

    let sketcherViewer = null;
    let sketcherPreview = null;

    let sketchTexture = null;

    let drawMode = false;

    let brush = 
    {
        size  : 0.05,
        color : [0.0,0.0,0.0]
    }

    let currentMousePos = [0,0]
    let previousMousePos = [0,0]

    let initialize = async function(baseUrl, viewerCanvasId, previewCanvasId)
    {
        let vertShaderPath =   baseUrl + "/shaders/default.vert";
        let sketcherShaderPath = baseUrl + "/shaders/equirectangular_sketch.frag";

        sketcherViewer = await PanoramaViewer(baseUrl, viewerCanvasId);
        sketcherPreview = await ShaderView(previewCanvasId, vertShaderPath, sketcherShaderPath);

        sketcherViewer.setMouseDownHandler(onMouseDown);
        sketcherViewer.setMouseDragHandler(onMouseDrag);
        sketcherViewer.setViewChangedHandler(onViewChanged);

        sketchTexture = sketcherPreview.addPlaceholderTexture("previousFrame", defaultColor);

        sketcherPreview.addRenderToTexture(sketchTexture);
        sketcherPreview.addRenderToTexture(sketcherViewer.getTexture(), function(){
            sketcherViewer.draw();
        });

        sketcherViewer.setCamera({
            yaw: 0.0,
            pitch: 0.0,
            fov: 90.0
        });

        sketcherPreview.setVariable("viewResolution", sketcherViewer.getResolution());
        sketcherPreview.setVariable("lineStart", [0,0]);
        sketcherPreview.setVariable("lineEnd", [0,0]);

        setBrushSize(0.05);

        sketcherPreview.draw();
    }

    let onViewChanged = function(cameraState)
    {
        sketcherPreview.setVariable("viewYaw", cameraState.yaw);
        sketcherPreview.setVariable("viewPitch", cameraState.pitch);
        sketcherPreview.setVariable("viewFov", cameraState.fov);
    }

    let onMouseDown = function(e)
    {
        var rect = e.target.getBoundingClientRect();
        var mouseX = (e.clientX - rect.left) / rect.width;
        var mouseY = (e.clientY - rect.top) / rect.height;

        currentMousePos = [mouseX, mouseY];
        previousMousePos = [mouseX, mouseY];

        sketcherPreview.setVariable("lineStart", currentMousePos);
        sketcherPreview.setVariable("lineEnd", previousMousePos);
    }

    let onMouseDrag = function(e)
    {
        if(drawMode)
        {
            var rect = e.target.getBoundingClientRect();
            var mouseX = (e.clientX - rect.left) / rect.width;
            var mouseY = (e.clientY - rect.top) / rect.height;

            previousMousePos = currentMousePos;
            currentMousePos = [mouseX, mouseY];

            sketcherPreview.setVariable("lineStart", currentMousePos);
            sketcherPreview.setVariable("lineEnd", previousMousePos);
            sketcherPreview.draw();
            return false;
        }
        else
        {
            return true;
        }
    }

    let setDrawMode = function(mode)
    {
        drawMode = mode;
    }

    let setBrushSize = function(size)
    {
        brush.size = size;
        sketcherPreview.setVariable("brushSize", size)
    }

    let setBrushColor = function(color)
    {
        brush.color = color;
        sketcherPreview.setVariable("brushColor", color)
    }

    let clearCanvas = function()
    {
        sketcherPreview.setVariable("clear", 1)
        sketcherPreview.draw();
        sketcherPreview.setVariable("clear", 0)
    }

    //Return a DataURL image of the panorama
    let getPanoramaImage = function(shaderViewName)
    {
        return sketcherPreview.getImageDataURL();
    }

    await initialize(baseUrl, viewerCanvasId, previewCanvasId);
    
    //Exported functions to be called from Python
    return {
        setDrawMode,
        setBrushSize,
        setBrushColor,
        clearCanvas,
        getPanoramaImage
    };
}
