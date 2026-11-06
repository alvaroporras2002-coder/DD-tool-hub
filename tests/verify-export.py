"""Independently decode the browser-exported sample using FFmpeg.

This reads a real MediaRecorder file produced by the Chromium smoke test,
not a stand-in encoder. The synthetic source has fixed 4px monochrome bars.
"""
from pathlib import Path
import array
import json
import math
import subprocess

artifacts = Path(__file__).with_name('artifacts')
files = sorted(artifacts.glob('video-export-sample.*'))
assert files, 'No browser-exported sample is available'
file = files[0]
probe = json.loads(subprocess.check_output([
    'ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', str(file)
]))
video = next((s for s in probe['streams'] if s['codec_type'] == 'video'), None)
audio = next((s for s in probe['streams'] if s['codec_type'] == 'audio'), None)
assert video and audio, 'The exported file must contain both video and audio'
width, height = video['width'], video['height']
assert (width, height) == (1280, 720), f'Unexpected export dimensions: {width}x{height}'
duration = float(probe['format']['duration'])
assert .6 <= duration <= 1.3, f'Unexpected exported duration: {duration}'
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(file), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
assert len(raw) == width * height * 3, 'The first encoded frame could not be decoded'
error = black_sum = white_sum = 0.0
black_count = white_count = 0
for y in range(256, 512):
    for x in range(256, 1024):
        i = (y * width + x) * 3
        luma = raw[i] * .2126 + raw[i + 1] * .7152 + raw[i + 2] * .0722
        expected = 0 if x % 8 < 4 else 255
        error += abs(luma - expected)
        if expected:
            white_sum += luma
            white_count += 1
        else:
            black_sum += luma
            black_count += 1
mae = error / (black_count + white_count)
contrast = white_sum / white_count - black_sum / black_count
assert mae < 35, f'Encoded first-frame detail lost: MAE={mae:.2f}, contrast={contrast:.2f}'
assert contrast > 170, f'Encoded first-frame contrast too low: {contrast:.2f}'
pcm = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(file), '-vn', '-f', 'f32le', '-ac', '1', '-'])
samples = array.array('f')
samples.frombytes(pcm)
rms = math.sqrt(sum(s * s for s in samples) / max(1, len(samples)))
assert rms > .01, f'Exported audio is missing or inaudible: RMS={rms:.5f}'
frames = int(video.get('nb_read_frames', 0))
assert frames >= 12, f'Too few decoded video frames: {frames}'
result = {'passed': True, 'videoCodec': video['codec_name'], 'audioCodec': audio['codec_name'], 'width': width, 'height': height, 'duration': duration, 'decodedFrames': frames, 'firstFrameMeanAbsoluteError': round(mae, 3), 'firstFrameContrast': round(contrast, 3), 'audioRms': round(rms, 5)}
(artifacts / 'ffmpeg-export-verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
print(f'CI_DETAIL: Passed {width}x{height}, {frames} frames, first-frame MAE {mae:.2f}, contrast {contrast:.1f}, audio RMS {rms:.4f}')
