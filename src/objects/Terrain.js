function Terrain ( o ) {

    o = o == undefined ? {} : o;

    

    this.callback = null;
    this.physicsUpdate = function(){};

    this.uvx = [ o.uv || 18, o.uv || 18 ];


    this.sample = o.sample == undefined ? [64,64] : o.sample;
    this.size = o.size === undefined ? [100,10,100] : o.size;

    this.data = {
        level: o.level || [1,0.2,0.05],
        frequency: o.frequency || [0.016,0.05,0.2],
        expo: o.expo || 1,
    }

    this.isWater = o.water || false;

    this.colorBase = this.isWater ? { r:0, g:0.7, b:1 } : { r:1, g:0.7, b:0 };

    this.maxspeed = 1;
    this.acc = 0.01;
    this.dec = 0.01;

    this.ease = new THREE.Vector2();

    // for perlin
    this.complexity = o.complexity == undefined ? 30 : o.complexity;
    this.complexity2 = o.complexity2 == undefined ? null : o.complexity2;

    this.local = new THREE.Vector3();
    if(o.local) this.local.fromArray( o.local );

    this.pp = new THREE.Vector3();

    this.lng = this.sample[0] * this.sample[1];
    var sx = this.sample[0] - 1;
    var sz = this.sample[1] - 1;
    this.rx = sx / this.size[0];
    this.rz = sz / this.size[2];
    this.ratio = 1 / this.sample[0];
    this.ruvx =  1.0 / ( this.size[0] / this.uvx[0] );
    this.ruvy = - ( 1.0 / ( this.size[2] / this.uvx[1] ) );

    this.is64 = o.is64 || false;

    this.heightData = this.is64 ? new Float64Array( this.lng ) : new Float32Array( this.lng );
    this.height = [];

    this.isAbsolute = o.isAbsolute || false;
    this.isReverse = o.isReverse || false;
    if( this.isReverse ) this.getReverseID();

    this.colors = new Float32Array( this.lng * 3 );
    this.geometry = new THREE.PlaneBufferGeometry( this.size[0], this.size[2], this.sample[0] - 1, this.sample[1] - 1 );
    this.geometry.rotateX( -Math.PI90 );
    this.geometry.computeBoundingSphere();

    this.geometry.addAttribute( 'color', new THREE.BufferAttribute( this.colors, 3 ) );
    this.vertices = this.geometry.attributes.position.array;

    this.wn = null;
    if(this.isWater){
        this.wn = view.loadTexture('terrain/water_n.jpg')
        this.wn.repeat = new THREE.Vector2( 3, 3 );
        this.wn.wrapS = this.wn.wrapT = THREE.RepeatWrapping;
        this.wn.anisotropy = 1;
    }

    //this.material = new THREE.MeshStandardMaterial({ 
    this.material = new THREE.MeshPhongMaterial({ 

        vertexColors: THREE.VertexColors, 
        name:'terrain', 

        shininess:30,
        reflectivity:0.6,
        specular : 0x161716,

        //metalness: this.isWater ? 0.8 : 0.4, 
        //roughness: this.isWater ? 0.5 : 0.6, 
        wireframe:false, 
        envMap: view.getEnvMap(),
        normalMap:this.wn,
        normalScale:this.isWater ? new THREE.Vector2(0.25,0.25):new THREE.Vector2(2,2),
        shadowSide:false,
        
    });


    var map_pars = [
        '#ifdef USE_MAP',
        '    uniform sampler2D map;',
        '    uniform sampler2D map1;',
        '    uniform sampler2D map2;',
        '#endif',
    ];

    var map = [
        '#ifdef USE_MAP',

            'float slope = vColor.r;',
            'vec4 baseColor = vec4(1.0);',

            'vec4 sand = mapTexelToLinear( texture2D( map, vUv ) );',
            'vec4 grass = mapTexelToLinear( texture2D( map1, vUv ) );',
            'vec4 rock = mapTexelToLinear( texture2D( map2, vUv ) );',

            'if (slope < .5) baseColor = grass;',
            'if (slope > .8) baseColor = rock;',
            'if ((slope<.8) && (slope >= .5)) baseColor = mix( grass , rock, (slope - .5) * (1. / (.8 - .5)));',
            'if (slope < .2) baseColor = mix( sand, grass, slope * (1.0/0.2) );',
            'diffuseColor *= baseColor;',
        '#endif',
    ];

    

    var normal_pars = [
        '#ifdef USE_NORMALMAP',

        'uniform sampler2D normalMap;',
        'uniform sampler2D normalMap1;',
        'uniform sampler2D normalMap2;',

        'uniform vec2 normalScale;',

        // Per-Pixel Tangent Space Normal Mapping
        // http://hacksoflife.blogspot.ch/2009/11/per-pixel-tangent-space-normal-mapping.html

        'vec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm, vec3 n_color ) {',

            // Workaround for Adreno 3XX dFd*( vec3 ) bug. See #9988

            'vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );',
            'vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );',
            'vec2 st0 = dFdx( vUv.st );',
            'vec2 st1 = dFdy( vUv.st );',

            'vec3 S = normalize( q0 * st1.t - q1 * st0.t );',
            'vec3 T = normalize( -q0 * st1.s + q1 * st0.s );',
            'vec3 N = normalize( surf_norm );',

            'vec3 mapN = n_color.xyz * 2.0 - 1.0;',
            'mapN.xy = normalScale * mapN.xy;',
            'mat3 tsn = mat3( S, T, N );',
            'return normalize( tsn * mapN );',

        '}',

        '#endif',
    ];

    var normal = [
        //'#ifdef FLAT_SHADED',
        //'vec3 fdx = vec3( dFdx( vViewPosition.x ), dFdx( vViewPosition.y ), dFdx( vViewPosition.z ) );',
        //'vec3 fdy = vec3( dFdy( vViewPosition.x ), dFdy( vViewPosition.y ), dFdy( vViewPosition.z ) );',
        //'vec3 normal = normalize( cross( fdx, fdy ) );',
        //'#else',
        //'    vec3 normal = normalize( vNormal );',
        //'#endif',
        '#ifdef USE_NORMALMAP',
        
            'vec4 extraNormal = vec4(1.0);',
            'vec4 sandN =  texture2D( normalMap, vUv );',
            'vec4 grassN = texture2D( normalMap1, vUv );',
            'vec4 rockN = texture2D( normalMap2, vUv );',
            'float slopeN = vColor.r;',

            'if (slopeN < .5) extraNormal = grassN;',
            'if (slopeN > .8) extraNormal = rockN;',
            'if ((slopeN<.8) && (slopeN >= .5)) extraNormal = mix( grassN , rockN, (slopeN - .5) * (1. / (.8 - .5)));',
            'if (slopeN < .2) extraNormal = mix( sandN, grassN, slopeN * (1.0/0.2) );',
            'normal = perturbNormal2Arb( -vViewPosition.xyz, normal.xyz, extraNormal.xyz );',
    
        '#endif',
    ];

    if(!this.isWater){


        this.mapsLink = [];
        this.maps = [ 'sand', 'grass', 'rock', 'sand_n', 'grass_n', 'rock_n' ];
        for( var i in this.maps ) this.mapsLink[i] = 'terrain/' + this.maps[i] +'.jpg';

        pool.load ( this.mapsLink, null, true, true );

        var textures = {}
        var name, txt;
        for( var i in this.maps ){

            name = this.maps[i];
            txt = pool.getResult()[name];
            txt.repeat = new THREE.Vector2( this.uvx[0], this.uvx[1] );
            txt.wrapS = txt.wrapT = THREE.RepeatWrapping;
            txt.anisotropy = 8;
            textures[name] = txt;

        }

        this.material.map = textures.sand;
        this.material.normalMap = textures.sand_n;

        this.material.onBeforeCompile = function ( shader ) {

            var uniforms = shader.uniforms;

            //uniforms['map'] = { value: textures.sand };
            uniforms['map1'] = { value: textures.grass };
            uniforms['map2'] = { value: textures.rock };

            //uniforms['normalMap'] = { value: textures.sand_n };
            uniforms['normalMap1'] = { value: textures.grass_n };
            uniforms['normalMap2'] = { value: textures.rock_n };


            var vertex = shader.vertexShader;
            var fragment = shader.fragmentShader;

            fragment = fragment.replace( '#include <map_pars_fragment>', map_pars.join("\n") );
            fragment = fragment.replace( '#include <normalmap_pars_fragment>', normal_pars.join("\n") );

            fragment = fragment.replace( '#include <map_fragment>', map.join("\n") );
            fragment = fragment.replace( '#include <normal_fragment_maps>', normal.join("\n") );

            fragment = fragment.replace( '#include <color_fragment>', '' );

            /*fragment = fragment.replace( '#include <alphamap_fragment>', '' );
            fragment = fragment.replace( '#include <emissivemap_fragment>', '' );
            fragment = fragment.replace( '#include <aomap_fragment>', '' );
            fragment = fragment.replace( '#include <roughnessmap_fragment>', 'float roughnessFactor = roughness;' );
            fragment = fragment.replace( '#include <metalnessmap_fragment>', 'float metalnessFactor = metalness;' );*/

            shader.uniforms = uniforms;
            shader.fragmentShader = fragment;

            return shader;
        }



    }

    //this.uniforms = uniforms;

    this.update();

    THREE.Mesh.call( this, this.geometry, this.material );

    this.name = o.name === undefined ? 'terrain' : o.name;
    this.position.fromArray( o.pos );



    this.castShadow = false;
    this.receiveShadow = true;

};

Terrain.prototype = Object.assign( Object.create( THREE.Mesh.prototype ), {

    constructor: Terrain,

    dispose: function () {

        this.geometry.dispose();
        this.material.dispose();
        
    },

    easing: function ( wait ) {

        var key = user.key;

        if( !key[0] || !key[1] ) return;

        var r = view.getAzimuthal();

        if( key[7] ) this.maxspeed = 1.5;
        else this.maxspeed = 0.25;

        //acceleration
        this.ease.y += key[1] * this.acc; // up down
        this.ease.x += key[0] * this.acc; // left right
        //speed limite
        this.ease.x = this.ease.x > this.maxspeed ? this.maxspeed : this.ease.x;
        this.ease.x = this.ease.x < -this.maxspeed ? -this.maxspeed : this.ease.x;
        this.ease.y = this.ease.y > this.maxspeed ? this.maxspeed : this.ease.y;
        this.ease.y = this.ease.y < -this.maxspeed ? -this.maxspeed : this.ease.y;

        //break
        if (!key[1]) {
            if (this.ease.y > this.dec) this.ease.y -= this.dec;
            else if (this.ease.y < -this.dec) this.ease.y += this.dec;
            else this.ease.y = 0;
        }
        if (!key[0]) {
            if (this.ease.x > this.dec) this.ease.x -= this.dec;
            else if (this.ease.x < -this.dec) this.ease.x += this.dec;
            else this.ease.x = 0;
        }

        if ( !this.ease.x && !this.ease.y ) return;

        this.local.z += Math.sin(r) * this.ease.x + Math.cos(r) * this.ease.y;
        this.local.x += Math.cos(r) * this.ease.x - Math.sin(r) * this.ease.y;

        this.update( wait );

    },

    getHeight: function ( x, z ) {

        x *= this.rx; //this.size[0];
        z *= this.rz; ///= this.size[2]; 
        x += this.sample[0]*0.5;
        z += this.sample[1]*0.5;
        x = Math.floor(x);
        z = Math.floor(z);
        var h = this.height[ this.findId( x, z ) ] || 1;
        return ( h * this.size[ 1 ] ) + this.position.y;

    },

    findId: function( x, z ){

        return x+(z*this.sample[1]);

    },

    getReverseID: function () {

        this.invId = [];

        var i = this.lng, n, x, z, zr, c, l=0;
        var sz = this.sample[1] - 1;

        while(i--){
            x = i % this.sample[0];
            z = Math.floor( i * this.ratio );
            zr = sz - z;
            this.invId[i] = this.findId( x, zr );
        }

    },

    update: function ( wait ) {

        if( this.isWater ){ 
            this.wn.offset.x+=0.002;
            this.wn.offset.y+=0.001;
        } else {
            this.material.map.offset.x = this.local.x * this.ruvx;
            this.material.map.offset.y = this.local.z * this.ruvy;
        }

        var v = this.pp;
        var cc = [1,1,1];
        var i = this.lng, n, x, z,  c, l=0, id, result;

        while( i-- ){

            n = i * 3;
            x = i % this.sample[0];
            z = Math.floor( i * this.ratio );

            v.set( x + ( this.local.x*this.rx ), this.local.y, z + ( this.local.z*this.rz ) );

            c = Math.noise( v, this.data );

            //c = Math.quinticSCurve(c);
            //c = Math.cubicSCurve(c)
            //c = Math.linear(c,0.2, 1);
            //c = Math.clamp(c,0.2,1)

            c = Math.pow( c, this.data.expo );

            c = c>1 ? 1:c;
            c = c<0 ? 0:c;
            
            this.height[ i ] = c;

            id = this.isReverse ? this.invId[i] : i;
            result = this.isAbsolute ? c : c * this.size[1];

            this.heightData[ id ] = result;

            this.vertices[ n + 1 ] = c * this.size[ 1 ];

            if( this.isWater ){

                cc = [ c * this.colorBase.r, c * this.colorBase.g, c * this.colorBase.b ];

            } else {

                cc = [ c, 0, 0];

            }

            this.colors[ n ] = cc[0];
            this.colors[ n + 1 ] = cc[1];
            this.colors[ n + 2 ] = cc[2];
            

        }

        this.physicsUpdate( this.name, this.heightData );

        if( wait === undefined ) this.updateGeometry();

    },

    updateGeometry: function () {

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.computeVertexNormals();

    }

});