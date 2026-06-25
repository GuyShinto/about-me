var camera, scene, renderer;
		var imageTexture, imageMaterial;
		var composer;
		var shaderTime = 0;
		var badTVParams, badTVPass;
		var staticParams, staticPass;
		var rgbParams, rgbPass;
		var filmParams, filmPass;
		var renderPass, copyPass;
		var gui;
		var pnoise, globalParams;
    var waveLine, waveTime = 0;

		init();
		animate();

		function init() {

			// Bio viewer using THREE.js only
			const container = document.getElementById('container');
			container.style.position = 'relative';
			container.style.width = '100%';
			container.style.height = '100vh';
			container.style.overflow = 'hidden';
			camera = new THREE.PerspectiveCamera(55, 4 / 3, 1, 5000);
			camera.position.z = 1000;
			scene = new THREE.Scene();

      

			// 4:3 blue background to indicate bounds (using THREE only)
			const bgWidth = 800*1.5; // 4:3 -> 800x600
			const bgHeight = 600*1.5;
			const bgGeo = new THREE.PlaneGeometry(bgWidth, bgHeight);
			const bgMat = new THREE.MeshBasicMaterial({ color: 0x0000ff });
			const bgPlane = new THREE.Mesh(bgGeo, bgMat);
			bgPlane.position.set(0, 0, -100); // place behind content
			scene.add(bgPlane);
      waveLine = createWave(new THREE.Vector3(0, 300, 0), 68, 0.08, 0.25, 2, 0xffffff);
      waveLine2 = createWave(new THREE.Vector3(0, 300, 0), 68, 0.04, 0.2, 1, 0xffffff);

			const bios = [
				{ name: 'X', desc: 'นักพัฒนาเว็บ ชื่นชอบงานด้านภาพและอินเทอร์แอคทีฟ', img: 'res/sample.jpg' },
				{ name: 'yaju senpai', desc: 'นักออกแบบ UX/UI ทำงานด้านประสบการณ์ผู้ใช้', img: 'res/sample2.jpg' },
				{ name: 'ml 250', desc: 'ช่างภาพและครีเอทีฟ ผู้ชอบถ่ายภาพทิวทัศน์', img: 'res/sample3.jpg' },
				{ name: 'blue whale', desc: 'นักเขียนและนักแปล สนใจวรรณกรรมร่วมสมัย', img: 'res/sample4.jpg' }
			];

			let current = 0;

			// image plane
			const imgGeo = new THREE.PlaneGeometry(320, 280);
			const imgMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
			const imgPlane = new THREE.Mesh(imgGeo, imgMat);
			imgPlane.position.x = -180;
			scene.add(imgPlane);

			// text panel rendered via canvas texture
			let textFont = 'Arial';
			function makeTextTexture(title, body) {
				const cw = 800, ch = 480;
				const c = document.createElement('canvas');
				c.width = cw; c.height = ch;
				const ctx = c.getContext('2d');
				ctx.fillStyle = '#111'; ctx.fillRect(0, 0, cw, ch);
				ctx.fillStyle = '#fff'; ctx.font = '55px ' + textFont; ctx.fillText(title, 20, 60);
				ctx.fillStyle = '#ccc'; ctx.font = '32px ' + textFont;
				wrapText(ctx, body, 20, 150, cw - 40, 40);
				return new THREE.CanvasTexture(c);
			}

			function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
				const words = text.split(' ');
				let line = '';
				for (let n = 0; n < words.length; n++) {
					const testLine = line + words[n] + ' ';
					const metrics = ctx.measureText(testLine);
					const testWidth = metrics.width;
					if (testWidth > maxWidth && n > 0) {
						ctx.fillText(line, x, y);
						line = words[n] + ' ';
						y += lineHeight;
					} else {
						line = testLine;
					}
				}
				ctx.fillText(line, x, y);
			}
			
			// text plane
			const textGeo = new THREE.PlaneGeometry(560, 360);
			const initialTextTex = makeTextTexture(bios[0].name, bios[0].desc);
			const textMat = new THREE.MeshBasicMaterial({ map: initialTextTex });
			const textPlane = new THREE.Mesh(textGeo, textMat);
			textPlane.position.x = 260;
			scene.add(textPlane);

			// load image textures lazily
			const loader = new THREE.TextureLoader();

			function updateBio(i) {
				const b = bios[i];
				loader.load(b.img, function (tex) {
					tex.encoding = THREE.sRGBEncoding;
					imgPlane.material.map = tex;
					imgPlane.material.needsUpdate = true;
				});
				const tex2 = makeTextTexture(b.name, b.desc);
				textPlane.material.map = tex2;
				textPlane.material.needsUpdate = true;
			}

			// simple prev/next button meshes
			const btnGeo = new THREE.PlaneGeometry(80, 40);
			const prevMat = new THREE.MeshBasicMaterial({ color: 0x777777 });
			const nextMat = new THREE.MeshBasicMaterial({ color: 0x777777 });
			const prevBtn = new THREE.Mesh(btnGeo, prevMat);
			const nextBtn = new THREE.Mesh(btnGeo, nextMat);
			prevBtn.position.set(-260, -220, 1);
			nextBtn.position.set(-160, -220, 1);
			scene.add(prevBtn, nextBtn);

			// label buttons using canvas textures
			function labelMesh(mesh, text) {
				const c = document.createElement('canvas'); c.width = 256; c.height = 128;
				const ctx = c.getContext('2d'); ctx.fillStyle = '#444'; ctx.fillRect(0, 0, c.width, c.height);
				ctx.fillStyle = '#fff'; ctx.font = '100px Arial'; ctx.fillText(text, 40, 100);
				const t = new THREE.CanvasTexture(c); mesh.material.map = t; mesh.material.needsUpdate = true;
			}
			labelMesh(prevBtn, 'Prev'); labelMesh(nextBtn, 'Next');

			// interaction
			const raycaster = new THREE.Raycaster();
			const mouse = new THREE.Vector2();

			function onClick(e) {
				const rect = (renderer && renderer.domElement) ? renderer.domElement.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
				mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
				mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
				raycaster.setFromCamera(mouse, camera);
				const hits = raycaster.intersectObjects([prevBtn, nextBtn]);
				if (hits.length > 0) {
					const obj = hits[0].object;
					if (obj === prevBtn) {
						current = (current - 1 + bios.length) % bios.length; updateBio(current);
					} else if (obj === nextBtn) {
						current = (current + 1) % bios.length; updateBio(current);
					}
				}
			}

			function onKey(e) {
				if (e.key === 'ArrowLeft') { current = (current - 1 + bios.length) % bios.length; updateBio(current); }
				if (e.key === 'ArrowRight') { current = (current + 1) % bios.length; updateBio(current); }
			}

			window.addEventListener('click', onClick, false);
			window.addEventListener('keydown', onKey, false);

			// load custom font then initial update
			const fontUrl = 'fonts/VCR_OSD_MONO_1.ttf';
			const fontName = 'VCR_OSD_MONO_1';
			if (window.FontFace) {
				try {
					const f = new FontFace(fontName, `url(${fontUrl})`);
					f.load().then(function(loaded){
						document.fonts.add(loaded);
						textFont = fontName;
						updateBio(0);
					}).catch(function(){
						updateBio(0);
					});
				} catch (e) {
					updateBio(0);
				}
			} else {
				updateBio(0);
			}

			//add stats
			stats = new Stats();
			stats.domElement.style.position = 'absolute';
			stats.domElement.style.top = '0px';
			container.appendChild(stats.domElement);

			//init renderer
			renderer = new THREE.WebGLRenderer({ antialias: true });
			renderer.setPixelRatio(window.devicePixelRatio || 1);
			const rendererSize = get4by3Size();
			renderer.setSize(rendererSize.width, rendererSize.height);
			renderer.domElement.style.position = 'absolute';
			renderer.domElement.style.left = '50%';
			renderer.domElement.style.top = '50%';
			renderer.domElement.style.transform = 'translate(-50%, -50%)';
			container.appendChild(renderer.domElement);

			//POST PROCESSING
			//Create Shader Passes
			renderPass = new THREE.RenderPass(scene, camera);
			badTVPass = new THREE.ShaderPass(THREE.BadTVShader);
			rgbPass = new THREE.ShaderPass(THREE.RGBShiftShader);
			filmPass = new THREE.ShaderPass(THREE.FilmShader);
			staticPass = new THREE.ShaderPass(THREE.StaticShader);
			copyPass = new THREE.ShaderPass(THREE.CopyShader);

			//set shader uniforms
			filmPass.uniforms.grayscale.value = 0;

			//Init DAT GUI control panel
			badTVParams = {
				show: true,
				distortion: 3.0,
				distortion2: 1.0,
				speed: 0.3,
				rollSpeed: 0.1
			};

			staticParams = {
				show: true,
				amount: 0.5,
				size: 4.0
			};

			rgbParams = {
				show: true,
				amount: 0.005,
				angle: 0.0,
			};

			filmParams = {
				show: true,
				count: 800,
				sIntensity: 0.9,
				nIntensity: 0.4
			};

			gui = new dat.GUI();

			var f1 = gui.addFolder('Bad TV');
			f1.add(badTVParams, 'show').onChange(onToggleShaders);
			f1.add(badTVParams, 'distortion', 0.1, 20).step(0.1).listen().name('Thick Distort').onChange(onParamsChange);
			f1.add(badTVParams, 'distortion2', 0.1, 20).step(0.1).listen().name('Fine Distort').onChange(onParamsChange);
			f1.add(badTVParams, 'speed', 0.0, 1.0).step(0.01).listen().name('Distort Speed').onChange(onParamsChange);
			f1.add(badTVParams, 'rollSpeed', 0.0, 1.0).step(0.01).listen().name('Roll Speed').onChange(onParamsChange);
			f1.open();

			var f2 = gui.addFolder('RGB Shift');
			f2.add(rgbParams, 'show').onChange(onToggleShaders);
			f2.add(rgbParams, 'amount', 0.0, 0.1).listen().onChange(onParamsChange);
			f2.add(rgbParams, 'angle', 0.0, 2.0).listen().onChange(onParamsChange);
			f2.open();

			var f4 = gui.addFolder('Static');
			f4.add(staticParams, 'show').onChange(onToggleShaders);
			f4.add(staticParams, 'amount', 0.0, 1.0).step(0.01).listen().onChange(onParamsChange);
			f4.add(staticParams, 'size', 1.0, 100.0).step(1.0).onChange(onParamsChange);
			f4.open();

			var f3 = gui.addFolder('Scanlines');
			f3.add(filmParams, 'show').onChange(onToggleShaders);
			f3.add(filmParams, 'count', 50, 1000).onChange(onParamsChange);
			f3.add(filmParams, 'sIntensity', 0.0, 2.0).step(0.1).onChange(onParamsChange);
			f3.add(filmParams, 'nIntensity', 0.0, 2.0).step(0.1).onChange(onParamsChange);
			f3.open();

			gui.close();

			onToggleShaders();
			onParamsChange();

			window.addEventListener('resize', onResize, false);
			renderer.domElement.addEventListener('click', randomizeParams, false);
			onResize();
			randomizeParams();
		}

		function onParamsChange() {

			//copy gui params into shader uniforms
			badTVPass.uniforms['distortion'].value = badTVParams.distortion;
			badTVPass.uniforms['distortion2'].value = badTVParams.distortion2;
			badTVPass.uniforms['speed'].value = badTVParams.speed;
			badTVPass.uniforms['rollSpeed'].value = badTVParams.rollSpeed;

			staticPass.uniforms['amount'].value = staticParams.amount;
			staticPass.uniforms['size'].value = staticParams.size;

			rgbPass.uniforms['angle'].value = rgbParams.angle * Math.PI;
			rgbPass.uniforms['amount'].value = rgbParams.amount;

			filmPass.uniforms['sCount'].value = filmParams.count;
			filmPass.uniforms['sIntensity'].value = filmParams.sIntensity;
			filmPass.uniforms['nIntensity'].value = filmParams.nIntensity;
		}


		function randomizeParams() {

			badTVParams.distortion = 0.5;
			badTVParams.distortion2 = 0.5;
			badTVParams.speed = 0.2;
			badTVParams.rollSpeed = 0;
			rgbParams.angle = 0;
			rgbParams.amount = 0.002;
			staticParams.amount = 0;

			onParamsChange();
		}

		function onToggleShaders() {

			//Add Shader Passes to Composer
			//order is important 
			composer = new THREE.EffectComposer(renderer);
			composer.addPass(renderPass);

			if (filmParams.show) {
				composer.addPass(filmPass);
			}

			if (badTVParams.show) {
				composer.addPass(badTVPass);
			}

			if (rgbParams.show) {
				composer.addPass(rgbPass);
			}

			if (staticParams.show) {
				composer.addPass(staticPass);
			}

			composer.addPass(copyPass);
			copyPass.renderToScreen = true;
		}

		function animate() {

			shaderTime += 0.1;
      waveTime += 0.05;
			if (waveLine) updateWave(waveLine, waveTime);
			if (waveLine2) updateWave(waveLine2, waveTime);
			badTVPass.uniforms['time'].value = shaderTime;
			filmPass.uniforms['time'].value = shaderTime;
			staticPass.uniforms['time'].value = shaderTime;

			requestAnimationFrame(animate);
			composer.render(0.1);
			stats.update();
		}
    function createWave(position, wavelength, frequency, speed, thickness, color) {
		const pointCount = 200;
		const length = wavelength * 16;
		const positions = new Float32Array((pointCount + 1) * 3);
		for (let i = 0; i <= pointCount; i++) {
			const x = (i / pointCount) * length - length / 2;
			positions[i * 3 + 0] = x;
			positions[i * 3 + 1] = 0;
			positions[i * 3 + 2] = 0;
		}

		const geometry = new THREE.BufferGeometry();
		if (geometry.setAttribute) {
			geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		} else {
			geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
		}

		const material = new THREE.LineBasicMaterial({
			color: color,
			linewidth: thickness
		});

		const line = new THREE.Line(geometry, material);
		line.position.copy(position);
		line.userData = {
			wavelength: wavelength,
			frequency: frequency,
			speed: speed,
			thickness: thickness,
			color: color,
			length: length,
			pointCount: pointCount,
			amplitude: wavelength * 0.3
		};

		scene.add(line);
		return line;
	}
		function updateWave(line, time) {
			const data = line.userData;
			const positions = line.geometry.attributes.position.array;
			const twoPi = Math.PI * 2;
			for (let i = 0; i <= data.pointCount; i++) {
				const x = (i / data.pointCount) * data.length - data.length / 2;
				const phase = x / data.wavelength * twoPi * data.frequency;
				const y = Math.sin(phase + time * data.speed) * data.amplitude;
				positions[i * 3 + 1] = y;
			}
			line.geometry.attributes.position.needsUpdate = true;
			line.geometry.computeBoundingSphere();
		}

		function get4by3Size() {
			const targetRatio = 4 / 3;
			const maxWidth = window.innerWidth;
			const maxHeight = window.innerHeight;
			if (maxWidth / maxHeight > targetRatio) {
				return {
					width: Math.floor(maxHeight * targetRatio),
					height: maxHeight
				};
			}
			return {
				width: maxWidth,
				height: Math.floor(maxWidth / targetRatio)
			};
		}

		function onResize() {
			const rendererSize = get4by3Size();
			renderer.setSize(rendererSize.width, rendererSize.height);
			if (composer && composer.setSize) {
				composer.setSize(rendererSize.width, rendererSize.height);
			}
			camera.aspect = 4 / 3;
			camera.updateProjectionMatrix();
		}