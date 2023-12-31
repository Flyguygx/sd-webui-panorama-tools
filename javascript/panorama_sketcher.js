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

    let undoBuffer = [];
    let maxUndoSteps = 5;

    let initialize = async function(baseUrl, viewerCanvasId, previewCanvasId)
    {
        let vertShaderPath =   baseUrl + "/shaders/default.vert";
        let sketcherShaderPath = baseUrl + "/shaders/equirectangular_sketch.frag";
        let referenceImagePath = baseUrl + "/images/reference_dot_grid.png";

        sketcherViewer = await PanoramaViewer(baseUrl, viewerCanvasId);
        sketcherPreview = await ShaderView(previewCanvasId, vertShaderPath, sketcherShaderPath);

        sketcherViewer.loadReferenceImage(referenceImagePath);
        sketcherViewer.setReferenceEnable(true);
        sketcherViewer.setMouseDownHandler(onMouseDown);
        sketcherViewer.setMouseUpHandler(onMouseUp);
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

        setBrushSize(brush.size);

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

        if(drawMode)
        {
            if(undoBuffer.length >= maxUndoSteps)
            {
                undoBuffer.shift();
            }

            undoBuffer.push(sketcherPreview.getImageDataURL());
            sketcherPreview.setVariable("drawing", 1);
        }
    }

    let onMouseUp = function(e)
    {
        sketcherPreview.setVariable("drawing", 0);
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

    let setMode = function(modeName)
    {
        modeName = modeName.toLowerCase();

        if(modeName === "look")
        {
            setDrawMode(false);
        }
        if(modeName === "draw")
        {
            setDrawMode(true);
            setBrushColor([1,1,1]);
        }
        if(modeName === "erase")
        {
            setDrawMode(true);
            setBrushColor([0,0,0]);
        }
    }

    let clearCanvas = function()
    {
        if(drawMode)
        {
            if(undoBuffer.length >= maxUndoSteps)
            {
                undoBuffer.shift();
            }

            undoBuffer.push(sketcherPreview.getImageDataURL());
        }

        sketcherPreview.setVariable("clear", 1)
        sketcherPreview.draw();
        sketcherPreview.setVariable("clear", 0)
    }

    //Return a DataURL image of the panorama
    let getPanoramaImage = function(shaderViewName)
    {
        return sketcherPreview.getImageDataURL();
    }

    //Revert to previous image.
    let revertDraw = function()
    {
        if(undoBuffer.length >= 1)
        {
            sketcherPreview.loadTexture('previousFrame', undoBuffer.pop(), function(loaded){
                sketcherPreview.draw();
            }, [0,0,0,255]);
        }
    }

    //Laod sketch image
    let loadSketchImage = function(url)
    {
        //loadTexture('preview_2d', 'equirectangular', url);
        sketcherPreview.loadTexture('previousFrame', url, function(loaded){
            sketcherPreview.draw();
        }, [0,0,0,255]);

        if(undoBuffer.length >= maxUndoSteps)
        {
            undoBuffer.shift();
        }

        undoBuffer.push(url);
    }

    await initialize(baseUrl, viewerCanvasId, previewCanvasId);
    
    //Exported functions to be called from Python
    return {
        setDrawMode,
        setBrushSize,
        setBrushColor,
        setMode,
        clearCanvas,
        getPanoramaImage,
        revertDraw,
        loadSketchImage
    };
}
