// The box a world module draws in: the runtime puts its canvas first in
// it, and the page's HUD, labels and controls go over it as children,
// built from the HUD kit (./hud: its frame, Menu, prompt, objective, toast,
// bubble, list, players chip, stick and touch buttons, laid out by tested
// rules).
//
// <WorldHost world={useWorld(...)} className="earth-stage" ...>{hud}</WorldHost>

export default function WorldHost({ world, className = '', children, ...rest }) {
  return (
    <div ref={world.host} className={`world-host ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
