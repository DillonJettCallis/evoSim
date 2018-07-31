import { randomColor } from './colors.js';

const microbeCount = 80;
const brainSize = 5;
const neuronSize = 5;

const brainMutationRate = 0.5;
const neuronMutationRate = 0.3;
const neuronMutationMax = 0.5;

const microbeStartingSize = 5;


function initCanvas(): CanvasRenderingContext2D {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    return canvas.getContext("2d")!;
}

export function main() {
    const context = initCanvas();
    const sim = new Sim(context);
    sim.run();
}

function clamp(num: number, max: number): number {
    if (num < 0) {
        return num ** 2 % max;
    } else {
        return num % max;
    }
}

class Randomizer {

    constructor(public readonly max: Point) {
    }

    randomMicrobe(): Microbe {
        return new Microbe(this.randomPoint(), microbeStartingSize, this.randomBrain(), randomColor());
    }

    randomPoint(): Point {
        return new Point(Math.random() * this.max.x, Math.random() * this.max.y);
    }

    randomBrain(): Brain {
        const neurons: Neuron[] = [];

        for (let i = 0; i < brainSize; i++) {
            neurons.push(this.randomNeuron());
        }

        return new Brain(neurons);
    }

    randomNeuron(): Neuron {
        const bits: number[][] = [];

        for (let i = 0; i < neuronSize; i++) {
            const row: number[] = [];

            for (let j = 0; j < neuronSize; j++) {
                row.push(Math.random() * 200 - 100);
            }

            bits.push(row);
        }

        return new Neuron(bits);
    }
}

class Sim {

    max: Point;
    randomizer: Randomizer;
    microbes: Microbe[];

    constructor(private context: CanvasRenderingContext2D) {
        this.max = new Point(context.canvas.width, context.canvas.height);
        this.randomizer = new Randomizer(this.max);
        this.microbes = this.initMicrobes();
    }

    run() {
        // window.setInterval(() => this.render(), 1000 / 30);
        window.setInterval(() => this.step(), 1000 / 30);
    }

    step() {
        this.render();

        const moves: Array<Microbe | null> = this.microbes.map(me => me.move(this.microbes, this.randomizer)).sort(Microbe.sorter);


        const living: Microbe[] = [];

        for (let i = 0; i < moves.length; i++) {
            let me = moves[i];

            if (me) {
                for (let j = i + 1; j < moves.length; j++) {
                    const other = moves[j];

                    if (other && me.doCollide(other)) {
                        me = me.eat(other);
                        moves[j] = null;
                        living.push(me.reproduce(this.randomizer.randomPoint()));
                    }
                }

                living.push(me);
            }
        }

        this.microbes = living;
    }

    render() {
        this.context.clearRect(0, 0, this.max.x, this.max.y);

        this.microbes.forEach(me => me.render(this.context));
    }

    initMicrobes(): Microbe[] {
        const out = [];

        for (let i = 0; i < microbeCount; i++) {
            out.push(this.randomizer.randomMicrobe());
        }

        return out;
    }

}


class Microbe {

    public static readonly sorter = (left: Microbe, right: Microbe) => right.size - left.size;

    constructor(private loc: Point, private size: number, private brain: Brain, private color: string) {

    }

    move(all: Microbe[], randomizer: Randomizer): Microbe {
        const choice = all.filter(other => this !== other)
            .map(other => {
                // my x, my y, other size relative to me. other distance to me, other direction to me
                const input = [this.loc.x, this.loc.y, other.size / this.size, other.loc.distanceTo(this.loc), other.loc.directionTo(this.loc)];

                return this.brain.think(input);
            }).reduce((prev, next) => prev[0] > next[0] ? prev : next);

        return this.step(choice, randomizer);
    }

    doCollide(other: Microbe): boolean {
        return other.loc.distanceTo(this.loc) < other.size + this.size;
    }

    eat(other: Microbe) {
        return new Microbe(this.loc, Math.min(this.size + other.size, 100), this.brain, this.color);
    }

    reproduce(loc: Point) {
        return new Microbe(loc, microbeStartingSize, this.brain.reproduce(), this.color);
    }

    render(context: CanvasRenderingContext2D) {
        context.beginPath();
        context.arc(this.loc.x, this.loc.y, this.size, 0, 2 * Math.PI);
        context.fillStyle = this.color;
        context.fill();
    }

    private step([, direction, speed]: number[], randomizer: Randomizer): Microbe {
        const clampedSpeed = clamp(speed, 10);
        const energy = this.size / 1000;

        const size = this.size - energy;

        if (size > 1) {
            const clampedDirection = clamp(direction, 360);
            const x = this.loc.x + Math.cos(clampedDirection) * clampedSpeed;
            const y = this.loc.y + Math.sin(clampedDirection) * clampedSpeed;

            return new Microbe(new Point(Math.max(0, Math.min(x, randomizer.max.x)), Math.max(0, Math.min(y, randomizer.max.y))), size, this.brain, this.color);
        } else {
            return randomizer.randomMicrobe();
        }
    }

}

class Point {
    constructor(public readonly x: number, public readonly y: number) {

    }

    distanceTo(other: Point): number {
        return Math.sqrt((other.x - this.x) ** 2 + (other.y - this.y) ** 2)
    }

    directionTo(other: Point): number {
        return Math.atan2(other.y - this.y, other.x - this.x);
    }
}

class Brain {

    constructor(private neurons: Neuron[]) {

    }

    think(input: number[]): number[] {
        return this.neurons.reduce((prev, next) => next.consider(prev), input)
    }

    reproduce() {
        const neurons = this.neurons.map(neuron => {
            if (Math.random() > brainMutationRate) {
                return neuron.reproduce();
            } else {
                return neuron;
            }
        });

        return new Brain(neurons);
    }

}

class Neuron {

    constructor(private synapse: number[][]) {

    }

    consider(input: number[]): number[] {
        const output = input.map(() => 0);

        for(let i = 0; i < this.synapse.length; i++){
            const layer = this.synapse[i];

            for(let j = 0; j < layer.length; j++){
                output[j] += input[i] * layer[j]
            }
        }

        return output;
    }

    reproduce(): Neuron {
        const synapse: number[][] = [];

        for (let i = 0; i < this.synapse.length; i++) {
            const next: number[] = [];
            const prev = this.synapse[i];

            for (let j = 0; j < prev.length; j++) {
                if (Math.random() > neuronMutationRate) {
                    next.push(Math.random() * 10 - 5 + prev[j]);
                } else {
                    next.push(prev[j]);
                }
            }

            synapse.push(next);
        }

        return new Neuron(synapse);
    }

}
