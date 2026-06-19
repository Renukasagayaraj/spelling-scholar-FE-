import dinoPeek from "@/assets/dino-peek.png";
import dinoFly from "@/assets/dino-fly.png";

/**
 * Decorative dino overlay for the "dino" theme. Renders as fixed,
 * pointer-events-none elements so they sit above the background image
 * but never interfere with the UI.
 */
export function DinoDecor() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Pterodactyls on the right edge */}
      <img
        src={dinoFly}
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={768}
        height={512}
        className="absolute top-[14vh] right-0 h-28 w-auto opacity-40 drop-shadow-xl select-none"
      />
      <img
        src={dinoFly}
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={768}
        height={512}
        className="absolute top-[36vh] right-0 h-28 w-auto opacity-40 drop-shadow-xl select-none"
      />
      {/* T-Rexes on the left edge */}
      <img
        src={dinoPeek}
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={512}
        height={768}
        className="absolute top-[8vh] left-0 h-36 w-auto opacity-40 drop-shadow-xl select-none"
      />
      <img
        src={dinoPeek}
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={512}
        height={768}
        className="absolute top-[34vh] left-0 h-36 w-auto opacity-40 drop-shadow-xl select-none"
      />
      <img
        src={dinoPeek}
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={512}
        height={768}
        className="absolute bottom-[26vh] left-0 h-36 w-auto opacity-40 drop-shadow-xl select-none"
      />
      <img
        src={dinoPeek}
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={512}
        height={768}
        className="absolute bottom-[4vh] left-0 h-36 w-auto opacity-40 drop-shadow-xl select-none"
      />
    </div>
  );
}
