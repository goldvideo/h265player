let logger;
let errorLogger;

function setLogger() {
    /*eslint-disable */
    logger = console.log;
    errorLogger = console.error;
    /*eslint-enable */
}



function log(message, ...optionalParams) {
    if (logger) {
        logger(message, ...optionalParams);
    }
}
function error(message, ...optionalParams) {
    if (errorLogger) {
        errorLogger(message, ...optionalParams);
    }
}

class NALU {

    static get NDR() { return 1; }
    static get IDR() { return 5; }
    static get SEI() { return 6; }
    static get SPS() { return 7; }
    static get PPS() { return 8; }
    static get AUD() { return 9; }

    static get TYPES() {
        return {
            [NALU.IDR]: 'IDR',
            [NALU.SEI]: 'SEI',
            [NALU.SPS]: 'SPS',
            [NALU.PPS]: 'PPS',
            [NALU.NDR]: 'NDR',
            [NALU.AUD]: 'AUD',
        };
    }

    static type(nalu) {
        if (nalu.ntype in NALU.TYPES) {
            return NALU.TYPES[nalu.ntype];
        } else {
            return 'UNKNOWN';
        }
    }

    constructor(data) {
        this.payload = data;
        this.nri = (this.payload[0] & 0x60) >> 5;
        this.ntype = this.payload[0] & 0x1f;
    }

    toString() {
        return `${NALU.type(this)}: NRI: ${this.getNri()}`;
    }

    getNri() {
        return this.nri >> 6;
    }

    type() {
        return this.ntype;
    }

    isKeyframe() {
        return this.ntype == NALU.IDR;
    }

    getSize() {
        return 4 + this.payload.byteLength;
    }

    getData() {
        const result = new Uint8Array(this.getSize());
        const view = new DataView(result.buffer);
        view.setUint32(0, this.getSize() - 4);

        result.set(this.payload, 4);
        return result;
    }
}

/**
 * Parser for exponential Golomb codes, a variable-bitwidth number encoding scheme used by h264.
*/

class ExpGolomb {

    constructor(data) {
        this.data = data;
        this.index = 0;
        this.bitLength = data.byteLength * 8;
    }

    get bitsAvailable() {
        return this.bitLength - this.index;
    }

    skipBits(size) {
        // console.log(`  skip bits: size=${size}, ${this.index}.`);
        if (this.bitsAvailable < size) {
            //throw new Error('no bytes available');
            return false;
        }
        this.index += size;
    }

    readBits(size, moveIndex = true) {
        // console.log(`  read bits: size=${size}, ${this.index}.`);
        const result = this.getBits(size, this.index, moveIndex);
        // console.log(`    read bits: result=${result}`);
        return result;
    }

    getBits(size, offsetBits, moveIndex = true) {
        if (this.bitsAvailable < size) {
            //throw new Error('no bytes available');
            return 0;
        }
        const offset = offsetBits % 8;
        const byte = this.data[(offsetBits / 8) | 0] & (0xff >>> offset);
        const bits = 8 - offset;
        if (bits >= size) {
            if (moveIndex) {
                this.index += size;
            }
            return byte >> (bits - size);
        } else {
            if (moveIndex) {
                this.index += bits;
            }
            const nextSize = size - bits;
            return (byte << nextSize) | this.getBits(nextSize, offsetBits + bits, moveIndex);
        }
    }

    skipLZ() {
        let leadingZeroCount;
        for (leadingZeroCount = 0; leadingZeroCount < this.bitLength - this.index; ++leadingZeroCount) {
            if (this.getBits(1, this.index + leadingZeroCount, false) !== 0) {
                // console.log(`  skip LZ  : size=${leadingZeroCount}, ${this.index}.`);
                this.index += leadingZeroCount;
                return leadingZeroCount;
            }
        }
        return leadingZeroCount;
    }

    skipUEG() {
        this.skipBits(1 + this.skipLZ());
    }

    skipEG() {
        this.skipBits(1 + this.skipLZ());
    }

    readUEG() {
        const prefix = this.skipLZ();
        return this.readBits(prefix + 1) - 1;
    }

    readEG() {
        const value = this.readUEG();
        if (0x01 & value) {
            // the number is odd if the low order bit is set
            return (1 + value) >>> 1; // add 1 to make it even, and divide by 2
        } else {
            return -1 * (value >>> 1); // divide by two then make it negative
        }
    }

    readBoolean() {
        return this.readBits(1) === 1;
    }
    readUByte(numberOfBytes = 1) {
        return this.readBits((numberOfBytes * 8));
    }
    readUShort() {
        return this.readBits(16);
    }
    readUInt() {
        return this.readBits(32);
    }
}

class H264Parser {

    static extractNALu(buffer) {
        let i = 0,
            length = buffer.byteLength,
            value,
            state = 0,
            result = [],
            lastIndex;

        while (i < length) {
            value = buffer[i++];
            // finding 3 or 4-byte start codes (00 00 01 OR 00 00 00 01)
            switch (state) {
                case 0:
                    if (value === 0) {
                        state = 1;
                    }
                    break;
                case 1:
                    if (value === 0) {
                        state = 2;
                    } else {
                        state = 0;
                    }
                    break;
                case 2:
                case 3:
                    if (value === 0) {
                        state = 3;
                    } else if (value === 1 && i < length) {
                        if (lastIndex) {
                            result.push(buffer.subarray(lastIndex, i - state -1));
                        }
                        lastIndex = i;
                        state = 0;
                    } else {
                        state = 0;
                    }
                    break;
                default:
                    break;
            }
        }

        if (lastIndex) {
            result.push(buffer.subarray(lastIndex, length));
        }
        return result;
    }

    /**
     * Advance the ExpGolomb decoder past a scaling list. The scaling
     * list is optionally transmitted as part of a sequence parameter
     * set and is not relevant to transmuxing.
     * @param decoder {ExpGolomb} exp golomb decoder
     * @param count {number} the number of entries in this scaling list
     * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
     */
    static skipScalingList(decoder, count) {
        let lastScale = 8,
            nextScale = 8,
            deltaScale;
        for (let j = 0; j < count; j++) {
            if (nextScale !== 0) {
                deltaScale = decoder.readEG();
                nextScale = (lastScale + deltaScale + 256) % 256;
            }
            lastScale = (nextScale === 0) ? lastScale : nextScale;
        }
    }

    /**
     * Read a sequence parameter set and return some interesting video
     * properties. A sequence parameter set is the H264 metadata that
     * describes the properties of upcoming video frames.
     * @param data {Uint8Array} the bytes of a sequence parameter set
     * @return {object} an object with configuration parsed from the
     * sequence parameter set, including the dimensions of the
     * associated video frames.
     */
    static readSPS(data) {
        let decoder = new ExpGolomb(data);
        let frameCropLeftOffset = 0,
            frameCropRightOffset = 0,
            frameCropTopOffset = 0,
            frameCropBottomOffset = 0,
            sarScale = 1,
            profileIdc,
            profileCompat,
            levelIdc,
            numRefFramesInPicOrderCntCycle,
            picWidthInMbsMinus1,
            picHeightInMapUnitsMinus1,
            frameMbsOnlyFlag,
            scalingListCount;
        decoder.readUByte();
        profileIdc = decoder.readUByte(); // profile_idc
        profileCompat = decoder.readBits(5); // constraint_set[0-4]_flag, u(5)
        decoder.skipBits(3); // reserved_zero_3bits u(3),
        levelIdc = decoder.readUByte(); // level_idc u(8)
        decoder.skipUEG(); // seq_parameter_set_id
        // some profiles have more optional data we don't need
        if (profileIdc === 100 ||
            profileIdc === 110 ||
            profileIdc === 122 ||
            profileIdc === 244 ||
            profileIdc === 44 ||
            profileIdc === 83 ||
            profileIdc === 86 ||
            profileIdc === 118 ||
            profileIdc === 128) {
            var chromaFormatIdc = decoder.readUEG();
            if (chromaFormatIdc === 3) {
                decoder.skipBits(1); // separate_colour_plane_flag
            }
            decoder.skipUEG(); // bit_depth_luma_minus8
            decoder.skipUEG(); // bit_depth_chroma_minus8
            decoder.skipBits(1); // qpprime_y_zero_transform_bypass_flag
            if (decoder.readBoolean()) { // seq_scaling_matrix_present_flag
                scalingListCount = (chromaFormatIdc !== 3) ? 8 : 12;
                for (let i = 0; i < scalingListCount; ++i) {
                    if (decoder.readBoolean()) { // seq_scaling_list_present_flag[ i ]
                        if (i < 6) {
                            H264Parser.skipScalingList(decoder, 16);
                        } else {
                            H264Parser.skipScalingList(decoder, 64);
                        }
                    }
                }
            }
        }
        decoder.skipUEG(); // log2_max_frame_num_minus4
        var picOrderCntType = decoder.readUEG();
        if (picOrderCntType === 0) {
            decoder.readUEG(); // log2_max_pic_order_cnt_lsb_minus4
        } else if (picOrderCntType === 1) {
            decoder.skipBits(1); // delta_pic_order_always_zero_flag
            decoder.skipEG(); // offset_for_non_ref_pic
            decoder.skipEG(); // offset_for_top_to_bottom_field
            numRefFramesInPicOrderCntCycle = decoder.readUEG();
            for (let i = 0; i < numRefFramesInPicOrderCntCycle; ++i) {
                decoder.skipEG(); // offset_for_ref_frame[ i ]
            }
        }
        decoder.skipUEG(); // max_num_ref_frames
        decoder.skipBits(1); // gaps_in_frame_num_value_allowed_flag
        picWidthInMbsMinus1 = decoder.readUEG();
        picHeightInMapUnitsMinus1 = decoder.readUEG();
        frameMbsOnlyFlag = decoder.readBits(1);
        if (frameMbsOnlyFlag === 0) {
            decoder.skipBits(1); // mb_adaptive_frame_field_flag
        }
        decoder.skipBits(1); // direct_8x8_inference_flag
        if (decoder.readBoolean()) { // frame_cropping_flag
            frameCropLeftOffset = decoder.readUEG();
            frameCropRightOffset = decoder.readUEG();
            frameCropTopOffset = decoder.readUEG();
            frameCropBottomOffset = decoder.readUEG();
        }
        if (decoder.readBoolean()) {
            // vui_parameters_present_flag
            if (decoder.readBoolean()) {
                // aspect_ratio_info_present_flag
                let sarRatio;
                const aspectRatioIdc = decoder.readUByte();
                switch (aspectRatioIdc) {
                    case 1: sarRatio = [1, 1]; break;
                    case 2: sarRatio = [12, 11]; break;
                    case 3: sarRatio = [10, 11]; break;
                    case 4: sarRatio = [16, 11]; break;
                    case 5: sarRatio = [40, 33]; break;
                    case 6: sarRatio = [24, 11]; break;
                    case 7: sarRatio = [20, 11]; break;
                    case 8: sarRatio = [32, 11]; break;
                    case 9: sarRatio = [80, 33]; break;
                    case 10: sarRatio = [18, 11]; break;
                    case 11: sarRatio = [15, 11]; break;
                    case 12: sarRatio = [64, 33]; break;
                    case 13: sarRatio = [160, 99]; break;
                    case 14: sarRatio = [4, 3]; break;
                    case 15: sarRatio = [3, 2]; break;
                    case 16: sarRatio = [2, 1]; break;
                    case 255: {
                        sarRatio = [decoder.readUByte() << 8 | decoder.readUByte(), decoder.readUByte() << 8 | decoder.readUByte()];
                        break;
                    }
                }
                if (sarRatio) {
                    sarScale = sarRatio[0] / sarRatio[1];
                }
            }
            if (decoder.readBoolean()) { decoder.skipBits(1); }

            if (decoder.readBoolean()) {
                decoder.skipBits(4);
                if (decoder.readBoolean()) {
                    decoder.skipBits(24);
                }
            }
            if (decoder.readBoolean()) {
                decoder.skipUEG();
                decoder.skipUEG();
            }
            if (decoder.readBoolean()) {
                let unitsInTick = decoder.readUInt();
                let timeScale = decoder.readUInt();
                let fixedFrameRate = decoder.readBoolean();
                
            }
        }
        return {
            width: Math.ceil((((picWidthInMbsMinus1 + 1) * 16) - frameCropLeftOffset * 2 - frameCropRightOffset * 2) * sarScale),
            height: ((2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16) - ((frameMbsOnlyFlag ? 2 : 4) * (frameCropTopOffset + frameCropBottomOffset)),
        };
    }

    constructor(remuxer) {
        this.remuxer = remuxer;
        this.track = remuxer.mp4track;
    }

    parseSPS(sps) {
        var config = H264Parser.readSPS(new Uint8Array(sps));

        this.track.width = config.width;
        this.track.height = config.height;
        this.track.sps = [new Uint8Array(sps)];
        this.track.codec = 'avc1.';

        let codecarray = new DataView(sps.buffer, sps.byteOffset + 1, 4);
        for (let i = 0; i < 3; ++i) {
            var h = codecarray.getUint8(i).toString(16);
            if (h.length < 2) {
                h = '0' + h;
            }
            this.track.codec += h;
        }
    }

    parsePPS(pps) {
        this.track.pps = [new Uint8Array(pps)];
    }

    parseNAL(unit) {
        if (!unit) return false;

        let push = false;
        switch (unit.type()) {
            case NALU.NDR:
                push = true;
                break;
            case NALU.IDR:
                push = true;
                break;
            case NALU.PPS:
                if (!this.track.pps) {
                    this.parsePPS(unit.getData().subarray(4));
                    if (!this.remuxer.readyToDecode && this.track.pps && this.track.sps) {
                        this.remuxer.readyToDecode = true;
                    }
                }
                push = true;
                break;
            case NALU.SPS:
                if (!this.track.sps) {
                    this.parseSPS(unit.getData().subarray(4));
                    if (!this.remuxer.readyToDecode && this.track.pps && this.track.sps) {
                        this.remuxer.readyToDecode = true;
                    }
                }
                push = true;
                break;
            case NALU.AUD:
                log('AUD - ignoing and disable HD mode for live channel');
                if (this.remuxer.isHDAvail) {
                    this.remuxer.isHDAvail = false;
                }
                break;
            case NALU.SEI:
                log('SEI - ignoing');
                break;
            default:
        }
        return push;
    }
}

class Event {
    constructor(type) {
        this.listener = {};
        this.type = type | '';
    }

    on(event, fn) {
        if (!this.listener[event]) {
            this.listener[event] = [];
        }
        this.listener[event].push(fn);
        return true;
    }

    off(event, fn) {
        if (this.listener[event]) {
            var index = this.listener[event].indexOf(fn);
            if (index > -1) {
                this.listener[event].splice(index, 1);
            }
            return true;
        }
        return false;
    }

    offAll() {
        this.listener = {};
    }

    dispatch(event, data) {
        if (this.listener[event]) {
            this.listener[event].map((each) => {
                each.apply(null, [data]);
            });
            return true;
        }
        return false;
    }
}

/**
 * Generate MP4 Box
 * taken from: https://github.com/dailymotion/hls.js
 */
const UINT32_MAX = Math.pow(2, 32) - 1;

class MP4 {
    static init() {
        MP4.types = {
            avc1: [], // codingname
            avcC: [],
            btrt: [],
            dinf: [],
            dref: [],
            esds: [],
            ftyp: [],
            hdlr: [],
            mdat: [],
            mdhd: [],
            mdia: [],
            mfhd: [],
            minf: [],
            moof: [],
            moov: [],
            mp4a: [],
            mvex: [],
            mvhd: [],
            sdtp: [],
            stbl: [],
            stco: [],
            stsc: [],
            stsd: [],
            stsz: [],
            stts: [],
            tfdt: [],
            tfhd: [],
            traf: [],
            trak: [],
            trun: [],
            trex: [],
            tkhd: [],
            vmhd: [],
            smhd: [],
        };

        var i;
        for (i in MP4.types) {
            if (MP4.types.hasOwnProperty(i)) {
                MP4.types[i] = [
                    i.charCodeAt(0),
                    i.charCodeAt(1),
                    i.charCodeAt(2),
                    i.charCodeAt(3),
                ];
            }
        }

        var videoHdlr = new Uint8Array([
            0x00, // version 0
            0x00, 0x00, 0x00, // flags
            0x00, 0x00, 0x00, 0x00, // pre_defined
            0x76, 0x69, 0x64, 0x65, // handler_type: 'vide'
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, 0x00, 0x00, 0x00, // reserved
            0x56, 0x69, 0x64, 0x65,
            0x6f, 0x48, 0x61, 0x6e,
            0x64, 0x6c, 0x65, 0x72, 0x00, // name: 'VideoHandler'
        ]);

        var audioHdlr = new Uint8Array([
            0x00, // version 0
            0x00, 0x00, 0x00, // flags
            0x00, 0x00, 0x00, 0x00, // pre_defined
            0x73, 0x6f, 0x75, 0x6e, // handler_type: 'soun'
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, 0x00, 0x00, 0x00, // reserved
            0x53, 0x6f, 0x75, 0x6e,
            0x64, 0x48, 0x61, 0x6e,
            0x64, 0x6c, 0x65, 0x72, 0x00, // name: 'SoundHandler'
        ]);

        MP4.HDLR_TYPES = {
            video: videoHdlr,
            audio: audioHdlr,
        };

        var dref = new Uint8Array([
            0x00, // version 0
            0x00, 0x00, 0x00, // flags
            0x00, 0x00, 0x00, 0x01, // entry_count
            0x00, 0x00, 0x00, 0x0c, // entry_size
            0x75, 0x72, 0x6c, 0x20, // 'url' type
            0x00, // version 0
            0x00, 0x00, 0x01, // entry_flags
        ]);

        var stco = new Uint8Array([
            0x00, // version
            0x00, 0x00, 0x00, // flags
            0x00, 0x00, 0x00, 0x00, // entry_count
        ]);

        MP4.STTS = MP4.STSC = MP4.STCO = stco;

        MP4.STSZ = new Uint8Array([
            0x00, // version
            0x00, 0x00, 0x00, // flags
            0x00, 0x00, 0x00, 0x00, // sample_size
            0x00, 0x00, 0x00, 0x00, // sample_count
        ]);
        MP4.VMHD = new Uint8Array([
            0x00, // version
            0x00, 0x00, 0x01, // flags
            0x00, 0x00, // graphicsmode
            0x00, 0x00,
            0x00, 0x00,
            0x00, 0x00, // opcolor
        ]);
        MP4.SMHD = new Uint8Array([
            0x00, // version
            0x00, 0x00, 0x00, // flags
            0x00, 0x00, // balance
            0x00, 0x00, // reserved
        ]);

        MP4.STSD = new Uint8Array([
            0x00, // version 0
            0x00, 0x00, 0x00, // flags
            0x00, 0x00, 0x00, 0x01]);// entry_count

        var majorBrand = new Uint8Array([105, 115, 111, 109]); // isom
        var avc1Brand = new Uint8Array([97, 118, 99, 49]); // avc1
        var minorVersion = new Uint8Array([0, 0, 0, 1]);

        MP4.FTYP = MP4.box(MP4.types.ftyp, majorBrand, minorVersion, majorBrand, avc1Brand);
        MP4.DINF = MP4.box(MP4.types.dinf, MP4.box(MP4.types.dref, dref));
    }

    static box(type, ...payload) {
        var size = 8,
            i = payload.length,
            len = i,
            result;
        // calculate the total size we need to allocate
        while (i--) {
            size += payload[i].byteLength;
        }
        result = new Uint8Array(size);
        result[0] = (size >> 24) & 0xff;
        result[1] = (size >> 16) & 0xff;
        result[2] = (size >> 8) & 0xff;
        result[3] = size & 0xff;
        result.set(type, 4);
        // copy the payload into the result
        for (i = 0, size = 8; i < len; ++i) {
            // copy payload[i] array @ offset size
            result.set(payload[i], size);
            size += payload[i].byteLength;
        }
        return result;
    }

    static hdlr(type) {
        return MP4.box(MP4.types.hdlr, MP4.HDLR_TYPES[type]);
    }

    static mdat(data) {
        return MP4.box(MP4.types.mdat, data);
    }

    static mdhd(timescale, duration) {
        duration *= timescale;
        const upperWordDuration = Math.floor(duration / (UINT32_MAX + 1));
        const lowerWordDuration = Math.floor(duration % (UINT32_MAX + 1));
        return MP4.box(MP4.types.mdhd, new Uint8Array([
            0x01, // version 1
            0x00, 0x00, 0x00, // flags
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, // creation_time
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, // modification_time
            (timescale >> 24) & 0xFF,
            (timescale >> 16) & 0xFF,
            (timescale >> 8) & 0xFF,
            timescale & 0xFF, // timescale
            (upperWordDuration >> 24),
            (upperWordDuration >> 16) & 0xFF,
            (upperWordDuration >> 8) & 0xFF,
            upperWordDuration & 0xFF,
            (lowerWordDuration >> 24),
            (lowerWordDuration >> 16) & 0xFF,
            (lowerWordDuration >> 8) & 0xFF,
            lowerWordDuration & 0xFF,
            0x55, 0xc4, // 'und' language (undetermined)
            0x00, 0x00
        ]));
    }

    static mdia(track) {
        return MP4.box(MP4.types.mdia, MP4.mdhd(track.timescale, track.duration), MP4.hdlr(track.type), MP4.minf(track));
    }

    static mfhd(sequenceNumber) {
        return MP4.box(MP4.types.mfhd, new Uint8Array([
            0x00,
            0x00, 0x00, 0x00, // flags
            (sequenceNumber >> 24),
            (sequenceNumber >> 16) & 0xFF,
            (sequenceNumber >> 8) & 0xFF,
            sequenceNumber & 0xFF, // sequence_number
        ]));
    }

    static minf(track) {
        if (track.type === 'audio') {
            return MP4.box(MP4.types.minf, MP4.box(MP4.types.smhd, MP4.SMHD), MP4.DINF, MP4.stbl(track));
        } else {
            return MP4.box(MP4.types.minf, MP4.box(MP4.types.vmhd, MP4.VMHD), MP4.DINF, MP4.stbl(track));
        }
    }

    static moof(sn, baseMediaDecodeTime, track) {
        return MP4.box(MP4.types.moof, MP4.mfhd(sn), MP4.traf(track, baseMediaDecodeTime));
    }
    /**
     * @param tracks... (optional) {array} the tracks associated with this movie
     */
    static moov(tracks, duration, timescale) {
        var
            i = tracks.length,
            boxes = [];

        while (i--) {
            boxes[i] = MP4.trak(tracks[i]);
        }

        return MP4.box.apply(null, [MP4.types.moov, MP4.mvhd(timescale, duration)].concat(boxes).concat(MP4.mvex(tracks)));
    }

    static mvex(tracks) {
        var
            i = tracks.length,
            boxes = [];

        while (i--) {
            boxes[i] = MP4.trex(tracks[i]);
        }
        return MP4.box.apply(null, [MP4.types.mvex].concat(boxes));
    }

    static mvhd(timescale, duration) {
        duration *= timescale;
        const upperWordDuration = Math.floor(duration / (UINT32_MAX + 1));
        const lowerWordDuration = Math.floor(duration % (UINT32_MAX + 1));
        let bytes = new Uint8Array([
            0x01, // version 1
            0x00, 0x00, 0x00, // flags
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, // creation_time
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, // modification_time
            (timescale >> 24) & 0xFF,
            (timescale >> 16) & 0xFF,
            (timescale >> 8) & 0xFF,
            timescale & 0xFF, // timescale
            (upperWordDuration >> 24),
            (upperWordDuration >> 16) & 0xFF,
            (upperWordDuration >> 8) & 0xFF,
            upperWordDuration & 0xFF,
            (lowerWordDuration >> 24),
            (lowerWordDuration >> 16) & 0xFF,
            (lowerWordDuration >> 8) & 0xFF,
            lowerWordDuration & 0xFF,
            0x00, 0x01, 0x00, 0x00, // 1.0 rate
            0x01, 0x00, // 1.0 volume
            0x00, 0x00, // reserved
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, 0x01, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x40, 0x00, 0x00, 0x00, // transformation: unity matrix
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, // pre_defined
            0xff, 0xff, 0xff, 0xff // next_track_ID
        ]);
        return MP4.box(MP4.types.mvhd, bytes);
    }

    static sdtp(track) {
        var
            samples = track.samples || [],
            bytes = new Uint8Array(4 + samples.length),
            flags,
            i;
        // leave the full box header (4 bytes) all zero
        // write the sample table
        for (i = 0; i < samples.length; i++) {
            flags = samples[i].flags;
            bytes[i + 4] = (flags.dependsOn << 4) |
                (flags.isDependedOn << 2) |
                (flags.hasRedundancy);
        }

        return MP4.box(MP4.types.sdtp, bytes);
    }

    static stbl(track) {
        return MP4.box(MP4.types.stbl, MP4.stsd(track), MP4.box(MP4.types.stts, MP4.STTS), MP4.box(MP4.types.stsc, MP4.STSC), MP4.box(MP4.types.stsz, MP4.STSZ), MP4.box(MP4.types.stco, MP4.STCO));
    }

    static avc1(track) {
        var sps = [],
            pps = [],
            i,
            data,
            len;
        // assemble the SPSs

        for (i = 0; i < track.sps.length; i++) {
            data = track.sps[i];
            len = data.byteLength;
            sps.push((len >>> 8) & 0xFF);
            sps.push((len & 0xFF));
            sps = sps.concat(Array.prototype.slice.call(data)); // SPS
        }

        // assemble the PPSs
        for (i = 0; i < track.pps.length; i++) {
            data = track.pps[i];
            len = data.byteLength;
            pps.push((len >>> 8) & 0xFF);
            pps.push((len & 0xFF));
            pps = pps.concat(Array.prototype.slice.call(data));
        }

        var avcc = MP4.box(MP4.types.avcC, new Uint8Array([
                0x01,   // version
                sps[3], // profile
                sps[4], // profile compat
                sps[5], // level
                0xfc | 3, // lengthSizeMinusOne, hard-coded to 4 bytes
                0xE0 | track.sps.length, // 3bit reserved (111) + numOfSequenceParameterSets
            ].concat(sps).concat([
                track.pps.length, // numOfPictureParameterSets
            ]).concat(pps))), // "PPS"
            width = track.width,
            height = track.height;
        // console.log('avcc:' + Hex.hexDump(avcc));
        return MP4.box(MP4.types.avc1, new Uint8Array([
            0x00, 0x00, 0x00, // reserved
            0x00, 0x00, 0x00, // reserved
            0x00, 0x01, // data_reference_index
            0x00, 0x00, // pre_defined
            0x00, 0x00, // reserved
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, // pre_defined
            (width >> 8) & 0xFF,
            width & 0xff, // width
            (height >> 8) & 0xFF,
            height & 0xff, // height
            0x00, 0x48, 0x00, 0x00, // horizresolution
            0x00, 0x48, 0x00, 0x00, // vertresolution
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, 0x01, // frame_count
            0x12,
            0x62, 0x69, 0x6E, 0x65, // binelpro.ru
            0x6C, 0x70, 0x72, 0x6F,
            0x2E, 0x72, 0x75, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, // compressorname
            0x00, 0x18,   // depth = 24
            0x11, 0x11]), // pre_defined = -1
        avcc,
        MP4.box(MP4.types.btrt, new Uint8Array([
            0x00, 0x1c, 0x9c, 0x80, // bufferSizeDB
            0x00, 0x2d, 0xc6, 0xc0, // maxBitrate
            0x00, 0x2d, 0xc6, 0xc0])) // avgBitrate
        );
    }

    static esds(track) {
        var configlen = track.config.byteLength;
        let data = new Uint8Array(26 + configlen + 3);
        data.set([
            0x00, // version 0
            0x00, 0x00, 0x00, // flags

            0x03, // descriptor_type
            0x17 + configlen, // length
            0x00, 0x01, // es_id
            0x00, // stream_priority

            0x04, // descriptor_type
            0x0f + configlen, // length
            0x40, // codec : mpeg4_audio
            0x15, // stream_type
            0x00, 0x00, 0x00, // buffer_size
            0x00, 0x00, 0x00, 0x00, // maxBitrate
            0x00, 0x00, 0x00, 0x00, // avgBitrate

            0x05, // descriptor_type
            configlen,
        ]);
        data.set(track.config, 26);
        data.set([0x06, 0x01, 0x02], 26 + configlen);
        // return new Uint8Array([
        //     0x00, // version 0
        //     0x00, 0x00, 0x00, // flags
        //
        //     0x03, // descriptor_type
        //     0x17+configlen, // length
        //     0x00, 0x01, //es_id
        //     0x00, // stream_priority
        //
        //     0x04, // descriptor_type
        //     0x0f+configlen, // length
        //     0x40, //codec : mpeg4_audio
        //     0x15, // stream_type
        //     0x00, 0x00, 0x00, // buffer_size
        //     0x00, 0x00, 0x00, 0x00, // maxBitrate
        //     0x00, 0x00, 0x00, 0x00, // avgBitrate
        //
        //     0x05 // descriptor_type
        // ].concat([configlen]).concat(track.config).concat([0x06, 0x01, 0x02])); // GASpecificConfig)); // length + audio config descriptor
        return data;
    }

    static mp4a(track) {
        var audiosamplerate = track.audiosamplerate;
        return MP4.box(MP4.types.mp4a, new Uint8Array([
            0x00, 0x00, 0x00, // reserved
            0x00, 0x00, 0x00, // reserved
            0x00, 0x01, // data_reference_index
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, track.channelCount, // channelcount
            0x00, 0x10, // sampleSize:16bits
            0x00, 0x00, // pre_defined
            0x00, 0x00, // reserved2
            (audiosamplerate >> 8) & 0xFF,
            audiosamplerate & 0xff, //
            0x00, 0x00]),
        MP4.box(MP4.types.esds, MP4.esds(track)));
    }

    static stsd(track) {
        if (track.type === 'audio') {
            return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp4a(track));
        } else {
            return MP4.box(MP4.types.stsd, MP4.STSD, MP4.avc1(track));
        }
    }

    static tkhd(track) {
        let id = track.id,
            duration = track.duration * track.timescale,
            width = track.width,
            height = track.height,
            upperWordDuration = Math.floor(duration / (UINT32_MAX + 1)),
            lowerWordDuration = Math.floor(duration % (UINT32_MAX + 1));
        return MP4.box(MP4.types.tkhd, new Uint8Array([
            0x01, // version 1
            0x00, 0x00, 0x07, // flags
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, // creation_time
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, // modification_time
            (id >> 24) & 0xFF,
            (id >> 16) & 0xFF,
            (id >> 8) & 0xFF,
            id & 0xFF, // track_ID
            0x00, 0x00, 0x00, 0x00, // reserved
            (upperWordDuration >> 24),
            (upperWordDuration >> 16) & 0xFF,
            (upperWordDuration >> 8) & 0xFF,
            upperWordDuration & 0xFF,
            (lowerWordDuration >> 24),
            (lowerWordDuration >> 16) & 0xFF,
            (lowerWordDuration >> 8) & 0xFF,
            lowerWordDuration & 0xFF,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, 0x00, // layer
            0x00, 0x00, // alternate_group
            0x00, 0x00, // non-audio track volume
            0x00, 0x00, // reserved
            0x00, 0x01, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x40, 0x00, 0x00, 0x00, // transformation: unity matrix
            (width >> 8) & 0xFF,
            width & 0xFF,
            0x00, 0x00, // width
            (height >> 8) & 0xFF,
            height & 0xFF,
            0x00, 0x00 // height
        ]));
    }

    static traf(track, baseMediaDecodeTime) {
        var sampleDependencyTable = MP4.sdtp(track),
            id = track.id,
            upperWordBaseMediaDecodeTime = Math.floor(baseMediaDecodeTime / (UINT32_MAX + 1)),
            lowerWordBaseMediaDecodeTime = Math.floor(baseMediaDecodeTime % (UINT32_MAX + 1));
        return MP4.box(MP4.types.traf,
            MP4.box(MP4.types.tfhd, new Uint8Array([
                0x00, // version 0
                0x00, 0x00, 0x00, // flags
                (id >> 24),
                (id >> 16) & 0XFF,
                (id >> 8) & 0XFF,
                (id & 0xFF), // track_ID
            ])),
            MP4.box(MP4.types.tfdt, new Uint8Array([
                0x01, // version 1
                0x00, 0x00, 0x00, // flags
                (upperWordBaseMediaDecodeTime >> 24),
                (upperWordBaseMediaDecodeTime >> 16) & 0XFF,
                (upperWordBaseMediaDecodeTime >> 8) & 0XFF,
                (upperWordBaseMediaDecodeTime & 0xFF),
                (lowerWordBaseMediaDecodeTime >> 24),
                (lowerWordBaseMediaDecodeTime >> 16) & 0XFF,
                (lowerWordBaseMediaDecodeTime >> 8) & 0XFF,
                (lowerWordBaseMediaDecodeTime & 0xFF)
            ])),
            MP4.trun(track,
                sampleDependencyTable.length +
                16 + // tfhd
                20 + // tfdt
                8 +  // traf header
                16 + // mfhd
                8 +  // moof header
                8),  // mdat header
            sampleDependencyTable);
    }

    /**
     * Generate a track box.
     * @param track {object} a track definition
     * @return {Uint8Array} the track box
     */
    static trak(track) {
        track.duration = track.duration || 0xffffffff;
        return MP4.box(MP4.types.trak, MP4.tkhd(track), MP4.mdia(track));
    }

    static trex(track) {
        var id = track.id;
        return MP4.box(MP4.types.trex, new Uint8Array([
            0x00, // version 0
            0x00, 0x00, 0x00, // flags
            (id >> 24),
            (id >> 16) & 0XFF,
            (id >> 8) & 0XFF,
            (id & 0xFF), // track_ID
            0x00, 0x00, 0x00, 0x01, // default_sample_description_index
            0x00, 0x00, 0x00, 0x00, // default_sample_duration
            0x00, 0x00, 0x00, 0x00, // default_sample_size
            0x00, 0x01, 0x00, 0x01, // default_sample_flags
        ]));
    }

    static trun(track, offset) {
        var samples = track.samples || [],
            len = samples.length,
            arraylen = 12 + (16 * len),
            array = new Uint8Array(arraylen),
            i,
            sample,
            duration,
            size,
            flags,
            cts;
        offset += 8 + arraylen;
        array.set([
            0x00, // version 0
            0x00, 0x0f, 0x01, // flags
            (len >>> 24) & 0xFF,
            (len >>> 16) & 0xFF,
            (len >>> 8) & 0xFF,
            len & 0xFF, // sample_count
            (offset >>> 24) & 0xFF,
            (offset >>> 16) & 0xFF,
            (offset >>> 8) & 0xFF,
            offset & 0xFF, // data_offset
        ], 0);
        for (i = 0; i < len; i++) {
            sample = samples[i];
            duration = sample.duration;
            size = sample.size;
            flags = sample.flags;
            cts = sample.cts;
            array.set([
                (duration >>> 24) & 0xFF,
                (duration >>> 16) & 0xFF,
                (duration >>> 8) & 0xFF,
                duration & 0xFF, // sample_duration
                (size >>> 24) & 0xFF,
                (size >>> 16) & 0xFF,
                (size >>> 8) & 0xFF,
                size & 0xFF, // sample_size
                (flags.isLeading << 2) | flags.dependsOn,
                (flags.isDependedOn << 6) |
                (flags.hasRedundancy << 4) |
                (flags.paddingValue << 1) |
                flags.isNonSync,
                flags.degradPrio & 0xF0 << 8,
                flags.degradPrio & 0x0F, // sample_flags
                (cts >>> 24) & 0xFF,
                (cts >>> 16) & 0xFF,
                (cts >>> 8) & 0xFF,
                cts & 0xFF, // sample_composition_time_offset
            ], 12 + 16 * i);
        }
        return MP4.box(MP4.types.trun, array);
    }

    static initSegment(tracks, duration, timescale) {
        if (!MP4.types) {
            MP4.init();
        }
        var movie = MP4.moov(tracks, duration, timescale),
            result;
        result = new Uint8Array(MP4.FTYP.byteLength + movie.byteLength);
        result.set(MP4.FTYP);
        result.set(movie, MP4.FTYP.byteLength);
        return result;
    }
}

class AACParser {

    get samplingRateMap() {
        return [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
    }

    get getAACHeaderData() {
        return this.aacHeader;
    }
    set setAACHeaderData(data = null) {
        this.aacHeader = data;
    }
    getHeaderLength(data) {
        return (data[1] & 0x01 ? 7 : 9);  // without CRC 7 and with CRC 9 Refs: https://wiki.multimedia.cx/index.php?title=ADTS
    }

    getFrameLength(data) {
        return ((data[3] & 0x03) << 11) | (data[4] << 3) | ((data[5] & 0xE0) >>> 5); // 13 bits length ref: https://wiki.multimedia.cx/index.php?title=ADTS
    }

    isAACPattern (data) {
        return data[0] === 0xff && (data[1] & 0xf0) === 0xf0 && (data[1] & 0x06) === 0x00;
    }
    extractAAC(buffer) {
        let i = 0,
            length = buffer.byteLength,
            result = [],
            headerLength,
            frameLength;

        if (!this.isAACPattern(buffer)) {
            error('Invalid ADTS audio format');
            return result;
        }
        headerLength = this.getHeaderLength(buffer);
        if (!this.aacHeader) {
            this.aacHeader = buffer.subarray(0, headerLength);
        }

        while (i < length) {
            frameLength = this.getFrameLength(buffer);
            result.push(buffer.subarray(headerLength, frameLength));
            buffer = buffer.slice(frameLength);
            i += frameLength;
        }
        return result;
    }

    constructor(remuxer) {
        this.remuxer = remuxer;
        this.track = remuxer.mp4track;
        this.aacHeader = null;
    }

    setAACConfig() {
        let objectType,
            sampleIndex,
            channelCount,
            config = new Uint8Array(2),
            headerData = this.getAACHeaderData;

        if (!headerData) return;

        objectType = ((headerData[2] & 0xC0) >>> 6) + 1;
        sampleIndex = ((headerData[2] & 0x3C) >>> 2);
        channelCount = ((headerData[2] & 0x01) << 2);
        channelCount |= ((headerData[3] & 0xC0) >>> 6);

        /* refer to http://wiki.multimedia.cx/index.php?title=MPEG-4_Audio#Audio_Specific_Config */
        config[0] = objectType << 3;
        config[0] |= (sampleIndex & 0x0E) >> 1;
        config[1] |= (sampleIndex & 0x01) << 7;
        config[1] |= channelCount << 3;

        this.track.codec = 'mp4a.40.' + objectType;
        this.track.channelCount = channelCount;
        this.track.config = config;
        this.remuxer.readyToDecode = true;
    }
}

let track_id = 1;
class BaseRemuxer {

    static getTrackID() {
        return track_id++;
    }
    
    constructor() {
        this.seq = 1;
    }

    flush() {
        this.seq++;
        this.mp4track.len = 0;
        this.mp4track.samples = [];
    }

    isReady() {
        if (!this.readyToDecode || !this.samples.length) return null;
        return true;
    }
}

class AACRemuxer extends BaseRemuxer {

    constructor() {
        super();
        this.readyToDecode = false;
        this.nextDts = 0;
        this.dts = 0;
        this.timescale = 1000;

        this.mp4track = {
            id: BaseRemuxer.getTrackID(),
            type: 'audio',
            channelCount: 0,
            len: 0,
            fragmented: true,
            timescale: this.timescale,
            duration: this.timescale,
            samples: [],
            config: '',
            codec: '',
        };

        this.samples = [];
        this.aac = new AACParser(this);
    }

    resetTrack() {
        this.readyToDecode = false;
        this.mp4track.codec = '';
        this.mp4track.channelCount = '';
        this.mp4track.config = '';
        this.mp4track.timescale = this.timescale;
    }

    remux(samples) {
        let config,
            sample,
            size,
            payload;
        for (let sample of samples) {
            payload = sample.units;
            size = payload.byteLength;
            this.samples.push({
                units: payload,
                size: size,
                duration: sample.duration,
            });
            this.mp4track.len += size;
            if (!this.readyToDecode) {
                this.aac.setAACConfig();
            }
        }
    }

    getPayload() {
        if (!this.isReady()) {
            return null;
        }

        let payload = new Uint8Array(this.mp4track.len);
        let offset = 0;
        let samples = this.mp4track.samples;
        let mp4Sample,
            duration;

        this.dts = this.nextDts;

        while (this.samples.length) {
            let sample = this.samples.shift();

            duration = sample.duration;

            if (duration <= 0) {
                log(`remuxer: invalid sample duration at DTS: ${this.nextDts} :${duration}`);
                this.mp4track.len -= sample.size;
                continue;
            }

            this.nextDts += duration;
            mp4Sample = {
                size: sample.size,
                duration: duration,
                cts: 0,
                flags: {
                    isLeading: 0,
                    isDependedOn: 0,
                    hasRedundancy: 0,
                    degradPrio: 0,
                    dependsOn: 1,
                },
            };

            payload.set(sample.units, offset);
            offset += sample.size;
            samples.push(mp4Sample);
        }

        if (!samples.length) return null;

        return new Uint8Array(payload.buffer, 0, this.mp4track.len);
    }
}

class H264Remuxer extends BaseRemuxer {

    constructor() {
        super();
        this.readyToDecode = false;
        this.nextDts = 0;
        this.dts = 0;
        this.timescale = 1000;

        this.mp4track = {
            id: BaseRemuxer.getTrackID(),
            type: 'video',
            len: 0,
            fragmented: true,
            sps: '',
            pps: '',
            width: 0,
            height: 0,
            timescale: this.timescale,
            duration: this.timescale,
            samples: [],
        };

        this.samples = [];
        this.h264 = new H264Parser(this);
    }

    resetTrack() {
        this.readyToDecode = false;
        this.mp4track.sps = '';
        this.mp4track.pps = '';
    }

    remux(samples) {
        let sample,
            units,
            unit,
            size,
            keyFrame;
        for (sample of samples) {
            units = [];
            size = 0;
            keyFrame = false;
            for (unit of sample.units) {
                if (this.h264.parseNAL(unit)) {
                    units.push(unit);
                    size += unit.getSize();
                    if (!keyFrame) {
                        keyFrame = unit.isKeyframe();
                    }
                }
            }

            if (units.length > 0 && this.readyToDecode) {
                this.mp4track.len += size;
                this.samples.push({
                    units: units,
                    size: size,
                    keyFrame: keyFrame,
                    duration: sample.duration,
                });
            }
        }
    }

    getPayload() {
        if (!this.isReady()) {
            return null;
        }

        let payload = new Uint8Array(this.mp4track.len);
        let offset = 0;
        let samples = this.mp4track.samples;
        let mp4Sample,
            duration;

        this.dts = this.nextDts;

        while (this.samples.length) {
            let sample = this.samples.shift(),
                units = sample.units;

            duration = sample.duration;

            if (duration <= 0) {
                log(`remuxer: invalid sample duration at DTS: ${this.nextDts} :${duration}`);
                this.mp4track.len -= sample.size;
                continue;
            }

            this.nextDts += duration;
            mp4Sample = {
                size: sample.size,
                duration: duration,
                cts: 0,
                flags: {
                    isLeading: 0,
                    isDependedOn: 0,
                    hasRedundancy: 0,
                    degradPrio: 0,
                    isNonSync: sample.keyFrame ? 0 : 1,
                    dependsOn: sample.keyFrame ? 2 : 1,
                },
            };

            for (const unit of units) {
                payload.set(unit.getData(), offset);
                offset += unit.getSize();
            }

            samples.push(mp4Sample);
        }

        if (!samples.length) return null;

        return new Uint8Array(payload.buffer, 0, this.mp4track.len);
    }
}

function appendByteArray(buffer1, buffer2) {
    let tmp = new Uint8Array((buffer1.byteLength|0) + (buffer2.byteLength|0));
    tmp.set(buffer1, 0);
    tmp.set(buffer2, buffer1.byteLength|0);
    return tmp;
}

function secToTime(sec) {
    let seconds,
        hours,
        minutes,
        result = '';

    seconds = Math.floor(sec);
    hours = parseInt(seconds / 3600, 10) % 24;
    minutes = parseInt(seconds / 60, 10) % 60;
    seconds = (seconds < 0) ? 0 : seconds % 60;

    if (hours > 0) {
        result += (hours < 10 ? '0' + hours : hours) + ':';
    }
    result += (minutes < 10 ? '0' + minutes : minutes) + ':' + (seconds < 10 ? '0' + seconds : seconds);
    return result;
}

class RemuxController extends Event {

    constructor(streaming) {
        super('remuxer');
        this.initialized = false;
        this.trackTypes = [];
        this.tracks = {};
        this.mediaDuration = streaming ? Infinity : 1000;
    }

    addTrack(type) {
        if (type === 'video' || type === 'both') {
            this.tracks.video = new H264Remuxer();
            this.trackTypes.push('video');
        }
        if (type === 'audio' || type === 'both') {
            this.tracks.audio = new AACRemuxer();
            this.trackTypes.push('audio');
        }
    }

    reset() {
        for (let type of this.trackTypes) {
            this.tracks[type].resetTrack();
        }
        this.initialized = false;
    }

    destroy() {
        this.tracks = {};
        this.offAll();
    }

    flush() {
        if (!this.initialized) {
            if (this.isReady()) {
                this.dispatch('ready');
                for (let type of this.trackTypes) {
                    let track = this.tracks[type];
                    let data = {
                        type: type,
                        payload: MP4.initSegment([track.mp4track], this.mediaDuration, track.mp4track.timescale),
                    };
                    this.dispatch('buffer', data);
                }
                log('Initial segment generated.');
                this.initialized = true;
            }
        } else {
            for (let type of this.trackTypes) {
                let track = this.tracks[type];
                let pay = track.getPayload();
                if (pay && pay.byteLength) {
                    const moof = MP4.moof(track.seq, track.dts, track.mp4track);
                    const mdat = MP4.mdat(pay);
                    let payload = appendByteArray(moof, mdat);
                    let data = {
                        type: type,
                        payload: payload,
                        dts: track.dts
                    };
                    this.dispatch('buffer', data);
                    let duration = secToTime(track.dts / 1000);
                    log(`put segment (${type}): ${track.seq} dts: ${track.dts} samples: ${track.mp4track.samples.length} second: ${duration}`);
                    track.flush();
                }
            }
        }
    }

    isReady() {
        for (let type of this.trackTypes) {
            if (!this.tracks[type].readyToDecode || !this.tracks[type].samples.length) return false;
        }
        return true;
    }

    remux(data) {
        for (let type of this.trackTypes) {
            let samples = data[type];
            if (type === 'audio' && this.tracks.video && !this.tracks.video.readyToDecode) continue; /* if video is present, don't add audio until video get ready */
            if (samples.length > 0) {
                this.tracks[type].remux(samples);
            }
        }
        this.flush();
    }
}

class BufferController extends Event {
    constructor(sourceBuffer, type) {
        super('buffer');

        this.type = type;
        this.queue = new Uint8Array();

        this.cleaning = false;
        this.pendingCleaning = 0;
        this.cleanOffset = 30;
        this.cleanRanges = [];

        this.sourceBuffer = sourceBuffer;
        this.sourceBuffer.addEventListener('updateend', () => {
            this.dispatch('updateend', Date.now());
            if (this.pendingCleaning > 0) {
                this.initCleanup(this.pendingCleaning);
                this.pendingCleaning = 0;
            }
            this.cleaning = false;
            if (this.cleanRanges.length) {
                this.doCleanup();
                return;
            }
        });

        this.sourceBuffer.addEventListener('error', (event)=> {
            this.dispatch('error', { type: this.type, name: 'buffer', error: event });
        });
    }

    destroy() {
        // this.cleanBuffers();
        this.queue = null;
        this.sourceBuffer = null;
        this.offAll();
    }

    doCleanup() {
        if (!this.cleanRanges.length) {
            this.cleaning = false;
            return;
        }
        let range = this.cleanRanges.shift();
        log(`${this.type} remove range [${range[0]} - ${range[1]})`);
        this.cleaning = true;
        this.sourceBuffer.remove(range[0], range[1]);
        this.dispatch('clearBuffer');
    }
    // cleanBuffers() {
    //     if (this.sourceBuffer) {
    //         let buffers = this.sourceBuffer.buffered;
    //         let length = buffers.length;
    //         for (let i = 0; i < length; i++){
    //             this.sourceBuffer.remove(buffers.start(i), buffers.end(i));
    //         }

    //     }
    // }
    initCleanup(cleanMaxLimit) {
        if (this.sourceBuffer.updating) {
            this.pendingCleaning = cleanMaxLimit;
            return;
        }
        if (this.sourceBuffer.buffered && this.sourceBuffer.buffered.length && !this.cleaning) {
            for (let i = 0; i < this.sourceBuffer.buffered.length; ++i) {
                let start = this.sourceBuffer.buffered.start(i);
                let end = this.sourceBuffer.buffered.end(i);

                if ((cleanMaxLimit - start) > this.cleanOffset) {
                    end = cleanMaxLimit - this.cleanOffset;
                    if (start < end) {
                        this.cleanRanges.push([start, end]);
                    }
                }
            }
            this.doCleanup();
        }
    }

    doAppend() {
        if (!this.queue.length) return;

        if (this.sourceBuffer.updating) {
            return;
        }

        try {
            this.sourceBuffer.appendBuffer(this.queue);
            this.queue = new Uint8Array();
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                log(`${this.type} buffer quota full`);
                this.dispatch('error', { type: this.type, name: 'QuotaExceeded', error: 'buffer error' });
                return;
            }
            error(`Error occured while appending ${this.type} buffer -  ${e.name}: ${e.message}`);
            this.dispatch('error', { type: this.type, name: 'unexpectedError', error: 'buffer error' });
        }
    }

    feed(data) {
        this.queue = appendByteArray(this.queue, data);
    }
}

// import { AACParser } from './parsers/aac.js';
window.MediaSource = window.MediaSource || window.WebKitMediaSource;

class JMuxmer extends Event {

    static isSupported(codec) {
        return (window.MediaSource && window.MediaSource.isTypeSupported(codec));
    }

    constructor(options) {
        super('jmuxer');
        window.MediaSource = window.MediaSource || window.WebKitMediaSource;

        let defaults = {
            node: '',
            mode: 'both', // both, audio, video
            flushingTime: 1500,
            clearBuffer: true,
            onReady: null, // function called when MSE is ready to accept frames
            fps: 30,
            debug: false,
            onClearBuffer: null
        };
        this.options = Object.assign({}, defaults, options);

        if (this.options.debug) {
            setLogger();
        }

        if (typeof this.options.node === 'string' && this.options.node == '') {
            error('no video element were found to render, provide a valid video element');
        }

        if (!this.options.fps) {
            this.options.fps = 30;
        }
        this.frameDuration = (1000 / this.options.fps) | 0;

        this.node = typeof this.options.node === 'string' ? document.getElementById(this.options.node) : this.options.node;

        this.sourceBuffers = {};
        this.isMSESupported = !!window.MediaSource;

        if (!this.isMSESupported) {
            throw 'Oops! Browser does not support media source extension.';
        }

        this.setupMSE();
        this.remuxController = new RemuxController(this.options.clearBuffer);
        this.remuxController.addTrack(this.options.mode);
        if (this.options.mode === 'audio') {
            this.aacParser = this.remuxController.tracks.audio.aac;
        }

        this.mseReady = false;
        this.lastCleaningTime = Date.now();
        this.keyframeCache = [];
        this.frameCounter  = 0;

        /* events callback */
        this.remuxController.on('buffer', this.onBuffer.bind(this));
        this.remuxController.on('ready', this.createBuffer.bind(this));
        this.startInterval();
    }

    setupMSE() {
        this.mediaSource = new MediaSource();
        this.node.src = URL.createObjectURL(this.mediaSource);
        this.mediaSource.addEventListener('sourceopen', this.onMSEOpen.bind(this));
        this.mediaSource.addEventListener('sourceclose', this.onMSEClose.bind(this));
        this.mediaSource.addEventListener('webkitsourceopen', this.onMSEOpen.bind(this));
        this.mediaSource.addEventListener('webkitsourceclose', this.onMSEClose.bind(this));
    }

    feed(data) {
        let remux = false,
            nalus,
            aacFrames,
            duration,
            chunks = {
                video: [],
                audio: []
            };

        if (!data || !this.remuxController) return;
        duration = data.duration ? parseInt(data.duration) : 0;
        if (data.video) {
            nalus = H264Parser.extractNALu(data.video);
            if (nalus.length > 0) {
                chunks.video = this.getVideoFrames(nalus, duration);
                remux = true;
            }
        }
        if (data.audio) {
            aacFrames = this.aacParser.extractAAC(data.audio);
            if (aacFrames.length > 0) {
                chunks.audio = this.getAudioFrames(aacFrames, duration);
                remux = true;
            }
        }
        if (!remux) {
            error('Input object must have video and/or audio property. Make sure it is not empty and valid typed array');
            return;
        }
        this.remuxController.remux(chunks);
    }

    getVideoFrames(nalus, duration) {
        let nalu,
            units = [],
            samples = [],
            naluObj,
            sampleDuration,
            adjustDuration = 0,
            numberOfFrames = [];

        for (nalu of nalus) {
            naluObj = new NALU(nalu);
            units.push(naluObj);
            if (naluObj.type() === NALU.IDR || naluObj.type() === NALU.NDR) {
                samples.push({units});
                units = [];
                if (this.options.clearBuffer) {
                    if (naluObj.type() === NALU.IDR) {
                        numberOfFrames.push(this.frameCounter);
                    }
                    this.frameCounter++;
                }
            }
        }
        
        if (duration) {
            sampleDuration = duration / samples.length | 0;
            adjustDuration = (duration - (sampleDuration * samples.length));
        } else {
            sampleDuration = this.frameDuration;
        }
        samples.map((sample) => {
            sample.duration = adjustDuration > 0 ? (sampleDuration + 1) : sampleDuration;
            if (adjustDuration !== 0) {
                adjustDuration--;
            }
        });

        /* cache keyframe times if clearBuffer set true */
        if (this.options.clearBuffer) {
            numberOfFrames = numberOfFrames.map((total) => {
                return (total * sampleDuration) / 1000;
            });
            this.keyframeCache = this.keyframeCache.concat(numberOfFrames);
        }
        return samples;
    }

    getAudioFrames(aacFrames, duration) {
        let samples = [],
            units,
            sampleDuration,
            adjustDuration = 0;

        for (units of aacFrames) {
            samples.push({units});
        }

        if (duration) {
            sampleDuration = duration / samples.length | 0;
            adjustDuration = (duration - (sampleDuration * samples.length));
        } else {
            sampleDuration = this.frameDuration;
        }
        samples.map((sample) => {
            sample.duration = adjustDuration > 0 ? (sampleDuration + 1) : sampleDuration;
            if (adjustDuration !== 0) {
                adjustDuration--;
            }
        });
        return samples;
    }

    destroy() {
        this.aacParser = null;
        this.stopInterval();
        if (this.mediaSource) {
            try {
                if (this.bufferControllers) {
                    this.mediaSource.endOfStream();
                    this.removeSourceBuffer();
                }
            } catch (e) {
                error(`mediasource is not available to end ${e.message}`);
            }
            this.mediaSource = null;
        }
        if (this.remuxController) {
            this.remuxController.destroy();
            this.remuxController = null;
        }
        if (this.bufferControllers) {
            for (let type in this.bufferControllers) {
                this.bufferControllers[type].destroy();
            }
            this.bufferControllers = null;
        }
        this.node = false;
        this.mseReady = false;
        this.videoStarted = false;
    }

    createBuffer() {
        if (!this.mseReady || !this.remuxController || !this.remuxController.isReady() || this.bufferControllers) return;
        this.bufferControllers = {};
        for (let type in this.remuxController.tracks) {
            let track = this.remuxController.tracks[type];
            if (!JMuxmer.isSupported(`${type}/mp4; codecs="${track.mp4track.codec}"`)) {
                error('Browser does not support codec');
                return false;
            }
            let sb = this.mediaSource.addSourceBuffer(`${type}/mp4; codecs="${track.mp4track.codec}"`);
            this.bufferControllers[type] = new BufferController(sb, type);
            this.sourceBuffers[type] = sb;
            this.bufferControllers[type].on('error', this.onBufferError.bind(this));
            this.bufferControllers[type].on('clearBuffer', this.onClearBuffer.bind(this));
            this.bufferControllers[type].on('updateend', this.onUpdateEnd.bind(this));
        }
    }
    onUpdateEnd(data){
        if (typeof this.options.onUpdateEnd === 'function') {
            this.options.onUpdateEnd(data);
        }
    }
    startInterval() {

        this.interval = setInterval(()=>{
            if (this.bufferControllers) {
                this.releaseBuffer();
                this.clearBuffer();
            }
        }, this.options.flushingTime);
    }

    stopInterval() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }

    releaseBuffer() {
        for (let type in this.bufferControllers) {
            this.bufferControllers[type].doAppend();
        }
    }

    getSafeBufferClearLimit(offset) {
        let maxLimit = (this.options.mode === 'audio' && offset) || 0,
            adjacentOffset;

        for (let i = 0; i < this.keyframeCache.length; i++) {
            if (this.keyframeCache[i] >= offset) {
                break;
            }
            adjacentOffset = this.keyframeCache[i];
        }

        if (adjacentOffset) {
            this.keyframeCache = this.keyframeCache.filter( keyframePoint => {
                if (keyframePoint < adjacentOffset) {
                    maxLimit = keyframePoint;
                }
                return keyframePoint >= adjacentOffset;
            });
        }
        
        return maxLimit;
    }

    clearBuffer() {
        if (this.options.clearBuffer && (Date.now() - this.lastCleaningTime) > 10000) {
            for (let type in this.bufferControllers) {
                let cleanMaxLimit = this.getSafeBufferClearLimit(this.node.currentTime);
                this.bufferControllers[type].initCleanup(cleanMaxLimit);
            }
            this.lastCleaningTime = Date.now();
        }
    }

    onBuffer(data) {
        if (this.bufferControllers && this.bufferControllers[data.type]) {
            this.bufferControllers[data.type].feed(data.payload);
        }
    }
    onClearBuffer() {
        if (typeof this.options.onClearBuffer === 'function') {
            this.options.onClearBuffer();
        }
    }
    removeSourceBuffer() {
        if (this.mediaSource) {
            let sourceBuffers = this.sourceBuffers;
            for (let type in sourceBuffers) {
                this.mediaSource.removeSourceBuffer(sourceBuffers[type]);
            }
        }
    }
    /* Events on MSE */
    onMSEOpen() {
        this.mseReady = true;
        this.createBuffer();
        if (typeof this.options.onReady === 'function') {
            this.options.onReady();
            this.options.onReady = null;
        }
    }

    onMSEClose() {
        this.mseReady = false;
        this.videoStarted = false;
    }

    onBufferError(data) {
        if (data.name == 'QuotaExceeded') {
            this.bufferControllers[data.type].initCleanup(this.node.currentTime);
            return;
        }

        if (this.mediaSource.sourceBuffers.length > 0 && this.sourceBuffers[data.type]) {
            this.mediaSource.removeSourceBuffer(this.sourceBuffers[data.type]);
        }
        if (this.mediaSource.sourceBuffers.length == 0) {
            try {
                this.mediaSource.endOfStream();
            } catch (e) {
                error('mediasource is not available to end');
            }
        }
    }
}

export default JMuxmer;
