export function CommandMenuShortcutBanner() {
  return (
    <div className="m-[4px] flex h-[58px] items-center rounded-xl bg-[#ffd729] px-4">
      <div className="mr-4 flex min-h-[24px] min-w-[24px] grow-0 items-center justify-center rounded-full bg-white">
        <svg width="8" height="15" viewBox="0 0 8 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0.234863 4.4209C0.234863 4.82552 0.274251 5.18896 0.353027 5.51123C0.435384 5.82992 0.539225 6.14681 0.664551 6.46191C0.789876 6.77344 0.920573 7.11361 1.05664 7.48242C1.19271 7.84766 1.31803 8.27197 1.43262 8.75537C1.55078 9.23877 1.63851 9.81706 1.6958 10.4902C1.71012 10.6693 1.771 10.8107 1.87842 10.9146C1.98942 11.0148 2.13444 11.0649 2.31348 11.0649H5.68115C5.86377 11.0649 6.00879 11.0148 6.11621 10.9146C6.22363 10.8107 6.2863 10.6693 6.3042 10.4902C6.36149 9.81706 6.44743 9.23877 6.56201 8.75537C6.6766 8.27197 6.80192 7.84766 6.93799 7.48242C7.07764 7.11361 7.21012 6.77344 7.33545 6.46191C7.46077 6.15039 7.56283 5.8335 7.6416 5.51123C7.72396 5.18896 7.76514 4.82731 7.76514 4.42627C7.76514 3.92855 7.66667 3.46842 7.46973 3.0459C7.27637 2.62337 7.00602 2.25456 6.65869 1.93945C6.31494 1.62435 5.9139 1.37907 5.45557 1.20361C5.00081 1.02816 4.51562 0.94043 4 0.94043C3.48079 0.94043 2.99382 1.02816 2.53906 1.20361C2.08431 1.37907 1.68327 1.62435 1.33594 1.93945C0.992188 2.25456 0.721842 2.62337 0.524902 3.0459C0.331543 3.46842 0.234863 3.92676 0.234863 4.4209ZM1.40039 4.4209C1.40039 4.08073 1.46842 3.76921 1.60449 3.48633C1.74414 3.20345 1.93392 2.95996 2.17383 2.75586C2.41374 2.54818 2.68945 2.38883 3.00098 2.27783C3.31608 2.16325 3.64909 2.10596 4 2.10596C4.35091 2.10954 4.68213 2.16683 4.99365 2.27783C5.30876 2.38883 5.58626 2.54818 5.82617 2.75586C6.06608 2.95996 6.25407 3.20345 6.39014 3.48633C6.52979 3.76921 6.59961 4.08073 6.59961 4.4209C6.59961 4.68945 6.56559 4.93473 6.49756 5.15674C6.43311 5.37516 6.34717 5.6097 6.23975 5.86035C6.1359 6.10742 6.02132 6.40283 5.896 6.74658C5.77425 7.09033 5.6543 7.51644 5.53613 8.0249C5.41797 8.52979 5.31771 9.15462 5.23535 9.89941H2.76465C2.67871 9.15462 2.57666 8.52979 2.4585 8.0249C2.34391 7.51644 2.22396 7.09033 2.09863 6.74658C1.97689 6.40283 1.8623 6.10742 1.75488 5.86035C1.65104 5.6097 1.5651 5.37516 1.49707 5.15674C1.43262 4.93473 1.40039 4.68945 1.40039 4.4209ZM2.23291 12.4614H5.76172C5.8763 12.4614 5.97119 12.4202 6.04639 12.3379C6.12516 12.2591 6.16455 12.1678 6.16455 12.064C6.16455 11.9565 6.12516 11.8634 6.04639 11.7847C5.97119 11.7059 5.8763 11.6665 5.76172 11.6665H2.23291C2.12191 11.6665 2.02702 11.7059 1.94824 11.7847C1.86947 11.8634 1.83008 11.9565 1.83008 12.064C1.83008 12.1678 1.86947 12.2591 1.94824 12.3379C2.02702 12.4202 2.12191 12.4614 2.23291 12.4614ZM4 14.1211C4.44043 14.1211 4.81104 14.0244 5.11182 13.8311C5.41618 13.6377 5.58268 13.3817 5.61133 13.063H2.37256C2.39762 13.3817 2.56413 13.6377 2.87207 13.8311C3.18001 14.0244 3.55599 14.1211 4 14.1211Z"
            fill="black"
          />
        </svg>
      </div>
      <div className="grow text-[11px] font-semibold text-black">Use CMD + SHIFT + K to open this menu next time!</div>
    </div>
  );
}