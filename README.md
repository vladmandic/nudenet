# NudeNet: NSFW Object Detection for TFJS and NodeJS

Models included in `/model-graph-*` were converted to TFJS Graph model format from the original repository  
Models descriptors and signature have been additionally parsed for readability

## Implementation

Actual model parsing implementation in `nudenet.js` does not follow original and is implemented using native TFJS ops and optimized for JavaScript execution

Code also includes simple bluring function that overlaps exposed body parts in the input image  

Function `processPrediction()` takes `model.predict()` output and returns object with array of detected body parts:

Possible body parts are defined as:

```js
const labels = {
  0: { id: 0, displayName: 'exposed anus' },
  1: { id: 1, displayName: 'exposed armpits' },
  2: { id: 2, displayName: 'belly' },
  3: { id: 3, displayName: 'exposed belly' },
  4: { id: 4, displayName: 'buttocks' },
  5: { id: 5, displayName: 'exposed buttocks' },
  6: { id: 6, displayName: 'female' },
  7: { id: 7, displayName: 'male' },
  8: { id: 8, displayName: 'feet' },
  9: { id: 9, displayName: 'exposed feet' },
  10: { id: 10, displayName: 'breast' },
  11: { id: 11, displayName: 'exposed breast' },
  12: { id: 12, displayName: 'vagina' },
  13: { id: 13, displayName: 'exposed vagina' },
  14: { id: 14, displayName: 'male breast' },
  15: { id: 15, displayName: 'exposed male breast' },
};
```

Actual result object includes:

- `detected`: array of
  - `score`: number
  - `classId`: number
  - `class`: string
  - `bbox`: `x`, `y`, `width`, `height`: numbers

And additionally, it augments results object with filtered detection objects that fit specific criteria

- `person`
- `sexy`
- `nude`

<br><hr><br>

## Example

![Example Image](outputs/nude.jpg)

<br><hr><br>

## Conversion

Original: <https://github.com/notAI-tech/NudeNet>

```shell
tensorflowjs_converter --input_format tf_saved_model --output_format tfjs_graph_model --strip_debug_ops=* --signature_name=predict --weight_shard_size_bytes=16777216 model-saved/ model-graph/
tensorflowjs_converter --input_format tf_saved_model --output_format tfjs_graph_model --strip_debug_ops=* --signature_name=predict --weight_shard_size_bytes=16777216 --quantize_float16=* ./model-saved ./model-graph-f16
```

## Test

```shell
node nudenet.js graph inputs/nude.jpg outputs/nude.jpg
```

```js
2021-03-25 08:14:08 INFO:  nudenet version 0.0.1
2021-03-25 08:14:08 INFO:  User: vlado Platform: linux Arch: x64 Node: v15.12.0
2021-03-25 08:14:08 INFO:  TensorFlow/JS Version 3.3.0
2021-03-25 08:14:08 INFO:  TensorFlow/JS Backend tensorflow
2021-03-25 08:14:08 INFO:  TensorFlow/JS Flags { IS_BROWSER: false, IS_NODE: true, DEBUG: false, PROD: true }
2021-03-25 08:14:08 STATE:  Loading graph model: 'file://model-graph/model.json'
2021-03-25 08:14:08 INFO:  Image: 'inputs/nude.jpg' width: 801 height: 1200
2021-03-25 08:14:10 DATA:  {
  detected: [
    { score: 0.872, classId: 3, class: 'exposed belly', bbox: { x: 193, y: 642, width: 244, height: 223 } },
    { score: 0.7449, classId: 11, class: 'exposed breast', bbox: { x: 372, y: 485, width: 143, height: 153 } },
    { score: 0.6699, classId: 6, class: 'female', bbox: { x: 284, y: 203, width: 165, height: 155 } },
    { score: 0.6033, classId: 11, class: 'exposed breast', bbox: { x: 202, y: 463, width: 141, height: 156 } },
    { score: 0.5385, classId: 12, class: 'vagina', bbox: { x: 187, y: 943, width: 94, height: 96 } },
    { score: 0.3684, classId: 10, class: 'breast', bbox: { x: 202, y: 463, width: 139, height: 157 } },
    [length]: 6
  ],
  image: { file: 'inputs/nude.jpg', width: 801, height: 1200 },
  person: [ { score: 0.6699, classId: 6, class: 'female', bbox: { x: 284, y: 203, width: 165, height: 155 } }, [length]: 1 ],
  sexy: [
    { score: 0.872, classId: 3, class: 'exposed belly', bbox: { x: 193, y: 642, width: 244, height: 223 } },
    { score: 0.3684, classId: 10, class: 'breast', bbox: { x: 202, y: 463, width: 139, height: 157 } },
    [length]: 2
  ],
  nude: [
    { score: 0.7449, classId: 11, class: 'exposed breast', bbox: { x: 372, y: 485, width: 143, height: 153 } },
    { score: 0.6033, classId: 11, class: 'exposed breast', bbox: { x: 202, y: 463, width: 141, height: 156 } },
    { score: 0.5385, classId: 12, class: 'vagina', bbox: { x: 187, y: 943, width: 94, height: 96 } },
    [length]: 3
  ]
}
2021-03-25 08:14:11 STATE:  Created output image: outputs/nude.jpg
2021-03-25 08:14:11 STATE:  Exec: model: 'file://model-graph/model.json' input: 'inputs/nude.jpg' output: 'outputs/nude.jpg' objects: 6
```

<br>
