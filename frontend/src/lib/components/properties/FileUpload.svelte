<script lang="ts">
	import Button from '$ui/Button.svelte';
	import { formatFileSize } from '$lib/utils';
	import { getAccessToken } from '$api/client';

	interface Props {
		propertyId?: number;
		accept?: string;
		multiple?: boolean;
		category?: string;
		endpoint?: string;
		onuploaded?: (result: any) => void;
	}

	let {
		propertyId,
		accept = 'image/*',
		multiple = true,
		category = 'property_images',
		endpoint,
		onuploaded
	}: Props = $props();

	interface FileState {
		file: File;
		progress: number;
		status: 'pending' | 'uploading' | 'done' | 'error';
		error?: string;
		preview?: string;
	}

	let files: FileState[] = $state([]);
	let dragOver = $state(false);
	let inputRef: HTMLInputElement;

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files) {
			addFiles(Array.from(e.dataTransfer.files));
		}
	}

	function handleSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) {
			addFiles(Array.from(input.files));
		}
		input.value = '';
	}

	function addFiles(newFiles: File[]) {
		const states: FileState[] = newFiles.map((file) => {
			const state: FileState = { file, progress: 0, status: 'pending' };
			if (file.type.startsWith('image/')) {
				state.preview = URL.createObjectURL(file);
			}
			return state;
		});
		files = [...files, ...states];
		// Auto-upload
		states.forEach((s) => uploadFile(s));
	}

	async function uploadFile(fileState: FileState) {
		const idx = files.indexOf(fileState);
		if (idx === -1) return;

		files[idx].status = 'uploading';
		files = [...files];

		const url = endpoint ?? (propertyId ? `/api/properties/${propertyId}/images` : '/api/documents/upload');
		const formData = new FormData();
		formData.append('file', fileState.file);
		formData.append('category', category);
		if (propertyId) formData.append('propertyId', String(propertyId));

		try {
			const xhr = new XMLHttpRequest();
			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable) {
					files[idx].progress = Math.round((e.loaded / e.total) * 100);
					files = [...files];
				}
			};

			const result = await new Promise((resolve, reject) => {
				xhr.onload = () => {
					if (xhr.status >= 200 && xhr.status < 300) {
						resolve(JSON.parse(xhr.responseText));
					} else {
						reject(new Error(xhr.statusText || 'Upload failed'));
					}
				};
				xhr.onerror = () => reject(new Error('Network error'));
				xhr.open('POST', url);
				const token = getAccessToken();
				if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
				xhr.send(formData);
			});

			files[idx].status = 'done';
			files[idx].progress = 100;
			files = [...files];
			onuploaded?.(result);
		} catch (e) {
			files[idx].status = 'error';
			files[idx].error = e instanceof Error ? e.message : 'Upload failed';
			files = [...files];
		}
	}

	function removeFile(index: number) {
		if (files[index].preview) URL.revokeObjectURL(files[index].preview!);
		files = files.filter((_, i) => i !== index);
	}

	const isUploading = $derived(files.some((f) => f.status === 'uploading'));
</script>

<div class="space-y-3">
	<!-- Drop zone -->
	<div
		class="relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors {dragOver
			? 'border-primary bg-primary/5'
			: 'border-muted-foreground/25 hover:border-primary/50'}"
		ondragover={(e) => { e.preventDefault(); dragOver = true; }}
		ondragleave={() => (dragOver = false)}
		ondrop={handleDrop}
		onclick={() => inputRef.click()}
		role="button"
		tabindex="0"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
		</svg>
		<p class="mt-2 text-sm text-muted-foreground">
			Arrastra archivos aquí o <span class="text-primary underline">selecciona</span>
		</p>
		<input
			bind:this={inputRef}
			type="file"
			{accept}
			{multiple}
			onchange={handleSelect}
			class="hidden"
		/>
	</div>

	<!-- File list -->
	{#if files.length > 0}
		<div class="space-y-2">
			{#each files as file, i}
				<div class="flex items-center gap-3 rounded-md border p-2">
					{#if file.preview}
						<img src={file.preview} alt="" class="h-10 w-10 rounded object-cover" />
					{:else}
						<div class="flex h-10 w-10 items-center justify-center rounded bg-muted">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
						</div>
					{/if}

					<div class="min-w-0 flex-1">
						<div class="truncate text-sm font-medium">{file.file.name}</div>
						<div class="text-xs text-muted-foreground">{formatFileSize(file.file.size)}</div>
						{#if file.status === 'uploading'}
							<div class="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
								<div class="h-full rounded-full bg-primary transition-all" style="width: {file.progress}%"></div>
							</div>
						{/if}
						{#if file.status === 'error'}
							<div class="text-xs text-destructive">{file.error}</div>
						{/if}
					</div>

					<div class="flex items-center gap-1">
						{#if file.status === 'done'}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
						{/if}
						<button onclick={() => removeFile(i)} class="rounded p-1 hover:bg-muted">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
