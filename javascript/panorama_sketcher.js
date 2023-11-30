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

    let initialize = async function(baseUrl, viewerCanvasId, previewCanvasId)
    {
        let vertShaderPath =   baseUrl + "/shaders/default.vert";
        let sketcherShaderPath = baseUrl + "/shaders/equirectangular_sketch.frag";

        sketcherViewer = await PanoramaViewer(baseUrl, viewerCanvasId);
        sketcherPreview = await ShaderView(previewCanvasId, vertShaderPath, sketcherShaderPath);

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

        sketcherPreview.setVariable("lineStart", [0,0]);
        sketcherPreview.draw();
    }

    let onViewChanged = function(cameraState)
    {
        sketcherPreview.setVariable("viewYaw", cameraState.yaw);
        sketcherPreview.setVariable("viewPitch", cameraState.pitch);
        sketcherPreview.setVariable("viewFov", cameraState.fov);
    }

    let onMouseDrag = function(e)
    {
        if(drawMode)
        {
            var rect = e.target.getBoundingClientRect();
            var mouseX = (e.clientX - rect.left) / rect.width;
            var mouseY = (e.clientY - rect.top) / rect.height;
            console.log([mouseX, mouseY]);
            sketcherPreview.setVariable("lineStart", [mouseX, mouseY]);
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
        getPanoramaImage
    };
}
