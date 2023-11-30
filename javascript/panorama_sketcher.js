PanoramaSketcher = async function(baseUrl, viewerCanvasId, previewCanvasId)
{
    let defaultColor = [128,128,128,255];

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

        sketchTexture = sketcherPreview.addPlaceholderTexture("previousFrame", defaultColor);

        sketcherPreview.addRenderToTexture(sketchTexture);
        sketcherPreview.addRenderToTexture(sketcherViewer.getTexture(), function(){
            sketcherViewer.draw();
        });

        sketcherPreview.setVariable("maskYaw", 0.0);
        sketcherPreview.setVariable("maskPitch", 90.0);
        sketcherPreview.setVariable("maskFov", 90.0);
        sketcherPreview.draw();
    }

    let setMode = function(mode)
    {
        if(mode == 0)
        {
            drawMode = false;
        }

        if(mode == 1)
        {
            drawMode = true;
        }
    }

    let setBrushSize = function(size)
    {
        brush.size = size;
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
        setMode,
        setBrushSize,
        setBrushColor,
        getPanoramaImage
    };
}
