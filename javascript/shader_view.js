ShaderView = async function(canvasId, vertShaderName, fragShaderName)
{
    let state = null;

    //Sets up a basic full-screen triangle in webgl2 with vert/frag shaders.
    let initializeState = async function(canvasId, vertShaderName, fragShaderName)
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
    
    //Load a named glsl shader into the given GL context
    let loadShader = async function(gl, shaderUrl, type)
    {
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

    //Set the value of a named uniform of a given type on a shader view.
    let setVariable = function(name, value)
    {
        let gl = state.glContext;
        let loc = gl.getUniformLocation(state.shaderProgram, name);
        if(loc === null)
        {
            return false;
        }

        type = Array.isArray(value) ? 
                (value.length == 1) ? "uniform1f"  :
                (value.length == 2) ? "uniform2fv" :
                (value.length == 3) ? "uniform3fv" :
                (value.length == 4) ? "uniform4fv" : null
            : "uniform1f"

        if(type === null)
        {
            return false;
        }
        
        gl.useProgram(state.shaderProgram);
        gl[type](loc, value);
        
        return true;
    }

    //Draws the given shader view and updates any assigned render-to textures.
    let draw = function()
    {
        let gl = state.glContext;
        gl.useProgram(state.shaderProgram);

        gl.bindBuffer(gl.ARRAY_BUFFER, state.vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.indexBuffer);
        let coord = gl.getAttribLocation(state.shaderProgram, "coordinates");
        gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(coord);

        setVariable("resolution", [state.canvas.width, state.canvas.height]);

        gl.viewport(0,0,state.canvas.width, state.canvas.height);

        //Bind assigned textures
        let unit = 0;
        for (const [name, texture] of Object.entries(state.textures)) 
        {    
            let texLoc = gl.getUniformLocation(state.shaderProgram, name);
            gl.uniform1i(texLoc, unit);  
            gl.activeTexture(gl.TEXTURE0+unit);
            gl.bindTexture(gl.TEXTURE_2D, texture.glTexture);
            unit++;
        }

        gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_SHORT,0);

        //Update assgned render-to textures.
        for(const renderToTexture of state.renderToTextures)
        {
            let dstGLContext = renderToTexture.glContext;
            let texture = renderToTexture.glTexture;
        
            dstGLContext.bindTexture(gl.TEXTURE_2D, texture);
            dstGLContext.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, gl.canvas);
            dstGLContext.generateMipmap(gl.TEXTURE_2D);

            renderToTexture.callback();
        }
    }

    //Get the resolution of a the shader view
    let getResolution = function()
    {
        return [state.canvas.width, state.canvas.height];
    }

    //Set the resolution of the named shader view
    let setResolution = function(width,height)
    {
        state.canvas.width = width;
        state.canvas.height = height;
    }

    //Return a DataURL image of the named shader view.
    let getImageDataURL = function()
    {
        return state.canvas.toDataURL("image/png", 1.0);
    }

    //Download an image og the specified shader view.
    let downloadImage = function(filename = 'untitled.png') {
        let canvas = state.canvas;
        let data = canvas.toDataURL("image/png", 1.0);
        let a = document.createElement('a');
        a.href = data;
        a.download = filename;
        a.click();
    }

    //Creates a 1x1 texture with the specified color.
    let addPlaceholderTexture = function(name, color = [0,0,0,255])
    {
        let gl = state.glContext;
        let texture = gl.createTexture();

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(color));

        return state.textures[name] = {
            glContext : gl,
            glTexture : texture
        };
    }

    //Load a texture from a URL
    let loadTexture = function(name, url, callback = function(loaded){}, errorColor = [255,0,0,255])
    {
        let gl = state.glContext;
        let texture = state.textures[name].glTexture;

        if(url)
        {
            let image = new Image();
            image.src = url;
            image.onload = function() 
            {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, image);
                gl.generateMipmap(gl.TEXTURE_2D);
                callback(true);
            };
        }
        else //Default to 1x1 texture with error color if url is blank/null/etc.
        {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(errorColor));
            callback(false);
            console.log("Failed to load texture \""+name+"\" from: "+url);
        }
    }
    
    let getTexture = function(name)
    {
        return state.textures[name];
    }

    let addRenderToTexture = function(texture, callback = function(){})
    {
        texture.callback = callback;
        state.renderToTextures.push(texture);
    }

    state = await initializeState(canvasId, vertShaderName, fragShaderName);

    //Exported functions
    return {
        canvas: state.canvas,
        setVariable,
        draw,
        getResolution,
        setResolution,
        getImageDataURL,
        downloadImage,
        addPlaceholderTexture,
        loadTexture,
        getTexture,
        addRenderToTexture
    };
};
