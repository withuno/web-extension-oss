export default function (props: any) {
  return (
    <div id="failure">
      <p>
        Oh no, something went wrong! <a href="mailto:support@uno.app">Contact us</a> to help resolve the issue.
      </p>
      <p>(error code: {props.failureCode})</p>
      <p>
        <a onClick={props.handleClickRefresh} href="#">
          Click here to refresh the page
        </a>
        .
      </p>
    </div>
  );
}
