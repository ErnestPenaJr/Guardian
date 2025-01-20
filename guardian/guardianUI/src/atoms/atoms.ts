import { WritableAtom, atom } from 'jotai'

export function atomWithToggle(
  initialValue?: boolean,
): WritableAtom<boolean, [boolean?], void> {
  const anAtom = atom(initialValue, (get, set, nextValue?: boolean) => {
    const update = nextValue ?? !get(anAtom)
    set(anAtom, update)
  })

  return anAtom as WritableAtom<boolean, [boolean?], void>
}

export const isOpenAtom = atomWithToggle(false)

export const sidebarAtom = atom(true)


let currentUser1 = {
  role: 'Administrator',
  email: 'testadmin@shieldlytics.com',
  status: 'Active'
}

export type UserInfo = {
  role: string
  email: string
  status: string
}

export const userInfoAtom = atom<UserInfo>(currentUser1);