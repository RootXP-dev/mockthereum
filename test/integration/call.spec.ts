/*
 * SPDX-FileCopyrightText: 2022 Tim Perry <tim@httptoolkit.tech>
 * SPDX-License-Identifier: Apache-2.0
 */

import Web3 from "web3";

import { decodeAbi, encodeAbi } from "../../src/abi";

import { Mockthereum, expect } from "../test-setup";

describe("Contract eth_call()", () => {

    const mockNode = Mockthereum.getLocal();

    // Start & stop your mock node to reset state between tests
    beforeEach(() => mockNode.start());
    afterEach(() => mockNode.stop());

    it("should return an error for unmatched contract calls by default", async () => {
        const web3 = new Web3(mockNode.url);
        const result = await web3.eth.call({
            to: '0x0000000000000000000000000000000000000000',
            data: '0x73eac5b1' + encodeAbi(['bool', 'string'], [true, 'test']).slice(2)
        }).catch(e => e);

        expect(result).to.be.instanceOf(Error);
        expect(result.message).to.equal(
            "Returned error: No Mockthereum rules found matching Ethereum contract call"
        );
    });

    it("can be matched by 'to' address for direct call()", async () => {
        await mockNode.forCall('0x0000000000000000000000000000000000000000')
            .thenReturn('string', 'mock result');

        const web3 = new Web3(mockNode.url);
        const matchingResult = await web3.eth.call({ to: '0x0000000000000000000000000000000000000000' }).catch(e => e);
        const nonMatchingResult = await web3.eth.call({ to: '0x9999999999999999999999999999999999999999' }).catch(e => e);

        expect(decodeAbi(['string'], matchingResult)).to.deep.equal(["mock result"]);
        expect(nonMatchingResult).to.be.instanceOf(Error);
    });

    it("can be matched by function signature for direct call()", async () => {
        await mockNode.forCall()
            .forFunction('function foobar(string, bool)') // Function sig, but not normalized
            .thenReturn('string', 'mock result');

        const web3 = new Web3(mockNode.url);
        const matchingResult = await web3.eth.call({
            to: '0x0000000000000000000000000000000000000000',
            data: '0x7fddde58' + encodeAbi(['string', 'bool'], ['test', true]).slice(2) // Manually calculated sig hash
        }).catch(e => e);
        const nonMatchingResult = await web3.eth.call({
            to: '0x0000000000000000000000000000000000000000',
            data: '0x99999999' + encodeAbi(['string', 'bool'], ['test', true]).slice(2)
        }).catch(e => e);

        expect(decodeAbi(['string'], matchingResult)).to.deep.equal(["mock result"]);
        expect(nonMatchingResult).to.be.instanceOf(Error);
    });

    it("can be matched by function params for direct call()", async () => {
        await mockNode.forCall()
            .withParams(['string', 'bool'], ['test', true])
            .thenReturn('string', 'mock result');

        const web3 = new Web3(mockNode.url);
        const matchingResult = await web3.eth.call({
            to: '0x0000000000000000000000000000000000000000',
            data: '0x7fddde58' + encodeAbi(['string', 'bool'], ['test', true]).slice(2)
        }).catch(e => e);
        const nonMatchingResult = await web3.eth.call({
            to: '0x0000000000000000000000000000000000000000',
            data: '0x7fddde58' + encodeAbi(['string', 'bool'], ['other', false]).slice(2)
        }).catch(e => e);

        expect(decodeAbi(['string'], matchingResult)).to.deep.equal(["mock result"]);
        expect(nonMatchingResult).to.be.instanceOf(Error);
    });

    it("can infer function matching/return types from the signature for direct call()", async () => {
        await mockNode.forCall()
            .forFunction("function foobar(bool, string) returns (int256)")
            .withParams([true, 'test'])
            .thenReturn([1234]);

        const web3 = new Web3(mockNode.url);
        const matchingResult = await web3.eth.call({
            to: '0x0000000000000000000000000000000000000000',
            data: '0x73eac5b1' + encodeAbi(['bool', 'string'], [true, 'test']).slice(2)
        }).catch(e => e);
        const nonMatchingResult = await web3.eth.call({
            to: '0x0000000000000000000000000000000000000000',
            data: '0x7fddde58' + encodeAbi(['bool', 'string'], [false, 'other']).slice(2)
        }).catch(e => e);

        expect(decodeAbi(['int256'], matchingResult)[0].toNumber()).to.equal(1234);
        expect(nonMatchingResult).to.be.instanceOf(Error);
    });
});
